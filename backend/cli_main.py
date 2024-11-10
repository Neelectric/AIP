# Main driver file to prompt our model
# System imports
import time

# External imports
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

# ------------------------------------------TRAINING-----------------------------------------------------------
# attempt to auto recognize the device!
device = "cpu"
if torch.cuda.is_available(): device = "cuda"
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available(): device = "mps"
print(f"using device {device}")


# Load model directly
model_id = "meta-llama/Llama-3.1-8B-Instruct"
# "Unispac/Gemma-2-9B-IT-With-Deeper-Safety-Alignment"
max_new_tokens = 50
num_choices = 5

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map=device,
    attn_implementation="eager",
    load_in_4bit=True
)
tokenizer.pad_token = tokenizer.eos_token
model.generation_config.pad_token_id = tokenizer.pad_token_id
model.generation_config.return_dict_in_generate = True
model.generation_config.output_scores = True
model.generation_config.output_logits = True
model.generation_config.do_sample = False

system_prompt = "You are a chatbot that is incredibly knowledgeable about Scotland."
print(f"System prompt: {system_prompt}")
# start_prompt = input("'What would you like to talk about?' ")
start_prompt = " "
if start_prompt == " ":
   start_prompt = "Please tell me about George street."
   

messages = [
  {"role": "system", "content": system_prompt},
  {"role": "user", "content": start_prompt}
]

input_messages = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
inputs = tokenizer(input_messages, return_tensors='pt').to(device)

def time_it(func, inputs=inputs):
    time_before = time.time()
    func(inputs=inputs)
    time_after = time.time()
    time_taken = time_after - time_before
    toks_per_s = max_new_tokens / time_taken
    print(f"Time taken: {time_taken:3f}, tokens/second: {toks_per_s:3f}")
    return

### THE FOLLOWING IS A WAY TO GET TEXT STREAMING TO WORK
# def stream(input_ids=input_ids):
#   streamer = TextStreamer(tokenizer, skip_prompt=True)
#   output = model.generate(**input_ids, streamer=streamer,
#                               pad_token_id=tokenizer.eos_token_id, 
#                               # max_length=2048, 
#                               max_new_tokens=max_new_tokens,
#                               temperature=0.000001,
#                               # top_p=0.8,
#                               # repetition_penalty=1.25
#                               )
#   return output

def manual(inputs=inputs):
  # prepare the input before we start iterating
  input_ids = inputs["input_ids"]
  num_tokens_input = input_ids.shape[-1]
  attention_mask = inputs["attention_mask"]

  # generate a token at a time
  for i in range(max_new_tokens):
    generate_decoder_only_output = model.generate(
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
    topk, indices = torch.topk(probs, k=num_choices, dim=-1)
    topk = torch.squeeze(topk).tolist()
    indices = torch.squeeze(indices)

    # if highest probability is below 40% we branch
    if topk[0] < 0.4: 
      print("-"*100)
      for i, pair in enumerate(zip(topk, indices)):
          prob, index = pair
          detokenized = tokenizer.decode(index, skip_special_tokens=True)
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
    attention_mask = torch.ones(1, input_ids.shape[-1]).to(device)
    detokenized_current_text = tokenizer.decode(input_ids.squeeze()[num_tokens_input:])
    print(detokenized_current_text)

# print("'First, we see what Llama3.1 8b instruct comes up with all on its own.'")
# time_it(stream, input_ids=input_ids)

print("'This time we steer every 10 tokens, starting from the 7th (arbitrarily)'")
time_it(manual, inputs=inputs)


# output = tokenizer.decode(input_ids[0], skip_special_tokens=True)
# print(output)
