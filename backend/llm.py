# Main driver file to prompt our model
# System imports
from threading import Thread

# External imports
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer


class LLM:
	#model_id = "meta-llama/Llama-3.1-8B-Instruct"
	#model_id = "Unispac/Gemma-2-9B-IT-With-Deeper-Safety-Alignment"
	model_id = "meta-llama/Llama-3.2-3B-Instruct"
	
	max_new_tokens = 600
	num_choices = 7
	chat_history = []
	#system_prompt = "You are a chatbot simulating a resident of Leith, in Scotland. In recent years the demand for housing increased immensely in the whole city, as well as Leith. As a result, rent prices shot up immensely, and many landlords forced tenants out of their flats to capitalize on new rental contracts with higher rates. You and many close friends of your community lost your long-term homes and had to resettle to other parts of the city were you were still able to afford rent. You are incredibly bitter and sad about this development, and have strong opinions about people who have taken your old flat and the landlords who forced you out."
	system_prompt = "You are a chatbot very knowledgeable about Edinburgh, giving responses in no more than one sentence."


	def __init__(self, device):
		self.device = device
		self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
		self.model = AutoModelForCausalLM.from_pretrained(
			self.model_id,
			device_map=device,
			attn_implementation="eager",
			load_in_4bit=True
		)
		self.tokenizer.pad_token = self.tokenizer.eos_token
		self.model.generation_config.pad_token_id = self.tokenizer.pad_token_id
		self.model.generation_config.return_dict_in_generate = True
		self.model.generation_config.output_scores = True
		self.model.generation_config.output_logits = True
		self.model.generation_config.do_sample = False

		self.streamer = TextIteratorStreamer(
			self.tokenizer, 
			skip_prompt=True, 
			decode_kwargs=dict(skip_special_tokens = True)
		)


	def generator(self, prompt: str, chat_history=chat_history):
		messages = [
			{"role": "system", "content": self.system_prompt},
			{"role": "user", "content": prompt}
		]
		input_messages = self.tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
		inputs = self.tokenizer(input_messages, return_tensors='pt').to(self.device)
		
		generation_kwargs = dict(inputs, streamer=self.streamer, max_new_tokens=1000)
		thread = Thread(target=self.model.generate, kwargs=generation_kwargs)
		thread.start()
		generated_text = ""
		for new_text in self.streamer:
			print(new_text)
			if "<|eot_id|>" in new_text:
				new_text = new_text.replace("<|eot_id|>", "")
			generated_text += new_text
			# yield new_text
		return generated_text
		# print(generated_text)
		# chat_history += generated_text
		# print(chat_history)


	def generator_dynamic(self, prompt: str):
		messages = [
			{"role": "system", "content": self.system_prompt},
			{"role": "user", "content": prompt}
		]
		input_messages = self.tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
		inputs = self.tokenizer(input_messages, return_tensors='pt').to(self.device)

		input_ids = inputs["input_ids"]
		num_tokens_input = input_ids.shape[-1]
		attention_mask = inputs["attention_mask"]

		# generate a token at a time
		for i in range(self.max_new_tokens):
			generate_decoder_only_output = self.model.generate(
				input_ids=input_ids, 
				attention_mask=attention_mask, 
				max_new_tokens=1, 
				do_sample=False, 
				temperature=None, 
				top_p=None
			) # is now of type GenerateDecoderOnlyOutput

			# softmax the scores and find the topk tokens with their probabilities
			output_ids = generate_decoder_only_output["sequences"]
			scores = generate_decoder_only_output["scores"][0]
			probs = torch.nn.functional.softmax(scores, dim=-1)
			topk, indices = torch.topk(probs, k=self.num_choices, dim=-1)
			topk = torch.squeeze(topk).tolist()
			indices = torch.squeeze(indices)

			# if highest probability is below 40% we branch
			if topk[0] < 0.3: 
				print("-"*100)
				for i, pair in enumerate(zip(topk, indices)):
					prob, index = pair
					detokenized = self.tokenizer.decode(index, skip_special_tokens=True)
					prob*=100
					print(f"{i+1}, {prob:.2f}%, {int(index)}, {detokenized}") #     
				print("-"*100)
				input_text = input("'Please add enter the number of the token you believe should come next:' ")
				choice_index = int(input_text)-1
				choice = indices[choice_index]

			else:
				choice = indices[0]
			choice = choice.unsqueeze(dim=0).unsqueeze(dim=0) # this is quite ugly but we effectively need it to have shape [1,1]
			input_ids = torch.cat((input_ids, choice), dim=1)
			attention_mask = torch.ones(1, input_ids.shape[-1]).to(self.device)
			detokenized_current_text = self.tokenizer.decode(input_ids.squeeze()[num_tokens_input:])
			print(self.tokenizer.decode(int(choice)))
			yield self.tokenizer.decode(int(choice))

		#     if "<|eot_id|>" in new_text:
		#         new_text = new_text.replace("<|eot_id|>", "")
		#     yield new_text
		# chat_history += generated_text