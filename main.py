# Main driver file to prompt our model
# System imports
import time
import os

# External imports
import torch
from tqdm import tqdm
from transformers import AutoTokenizer, AutoModelForCausalLM, TextStreamer

# Local imports
# from arithmetic_pretrained_transformer import APT, APTConfig, DataLoaderLite
# from apt_tokenizer import APTTokenizer

# Environment prep
# torch.manual_seed(42)
# torch.cuda.manual_seed(42)
# torch.mps.manual_seed(42)
# torch.set_printoptions(sci_mode=False)
# from torch.utils.tensorboard import SummaryWriter
# writer = SummaryWriter()

# ------------------------------------------TRAINING-----------------------------------------------------------
# attempt to auto recognize the device!
device = "cpu"
if torch.cuda.is_available(): device = "cuda"
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available(): device = "mps"
print(f"using device {device}")


# Load model directly

model_id = "meta-llama/Llama-3.1-8B-Instruct"
"Unispac/Gemma-2-9B-IT-With-Deeper-Safety-Alignment"
max_new_tokens = 50
num_choices = 5

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map=device,
    attn_implementation="eager",)
tokenizer.pad_token = tokenizer.eos_token
model.generation_config.pad_token_id = tokenizer.pad_token_id
model.generation_config.return_dict_in_generate = True

system_prompt = "You are a chatbot that is incredibly knowledgeable about Scotland."
print(f"System prompt: {system_prompt}")
start_prompt = input("'What would you like to talk about?' ")
if start_prompt == " ":
   start_prompt = "Please tell me about George street."
   

messages = [
  {"role": "system", "content": system_prompt},
  {"role": "user", "content": start_prompt}
]

input_messages = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
input_ids = tokenizer(input_messages, return_tensors='pt').to("mps")

def time_it(func):
    time_before = time.time()
    func()
    time_after = time.time()
    time_taken = time_after - time_before
    toks_per_s = max_new_tokens / time_taken
    print(f"Time taken: {time_taken:3f}, tokens/second: {toks_per_s:3f}")
    return

### THE FOLLOWING IS A WAY TO GET TEXT STREAMING TO WORK
def stream():
  streamer = TextStreamer(tokenizer, skip_prompt=True)
  _ = model.generate(**input_ids, streamer=streamer,
                              pad_token_id=tokenizer.eos_token_id, 
                              # max_length=2048, 
                              max_new_tokens=max_new_tokens,
                              temperature=0.000001,
                              # top_p=0.8,
                              # repetition_penalty=1.25
                              )

def manual():
  output_ids = input_ids["input_ids"]
  attention_mask = input_ids["attention_mask"]
  initial_prompt_length = output_ids.shape[-1]
  attention_mask_dummy = torch.tensor([[1]]).to(device)
  for i in range(max_new_tokens):
      if i % 10 == 7:
         num_tokens_so_far = output_ids.shape[-1]
         temp = model.generate(
            input_ids=output_ids, 
            attention_mask=attention_mask, 
            max_new_tokens=1, 
            num_return_sequences=num_choices, 
            do_sample=False, 
            temperature=None, 
            top_p=None, 
            num_beams=num_choices
            )
         options = []
         print("-"*100)
         for i, completion in enumerate(temp):
            last_bit = tokenizer.decode(completion[num_tokens_so_far:], skip_special_tokens=True)
            print(i+1, last_bit)
            options.append(last_bit)
         print("-"*100)
         input_text = input("'Please add enter the number of the token you believe should come next:' ")
         choice = options[int(input_text)-1]
         tokenixed_input_text = tokenizer.encode(choice, return_tensors="pt", add_special_tokens=False).to(device)
         output_ids = torch.cat((output_ids, tokenixed_input_text), dim=1)
         attention_mask_additions = torch.ones(1, tokenixed_input_text.shape[-1]).to(dtype=torch.int64, device=device)
         attention_mask = torch.cat((attention_mask, attention_mask_additions), dim=1)
      else:
        output_ids = model.generate(
           input_ids=output_ids, 
           attention_mask=attention_mask, 
           max_new_tokens=1, 
           do_sample=False, 
           temperature=None, 
           top_p=None
           ) # is now of type GenerateDecoderOnlyOutput
        print(tokenizer.decode(output_ids[0][initial_prompt_length:], skip_special_tokens=True))
        attention_mask = torch.cat((attention_mask, attention_mask_dummy), dim=1)
      
print("'First, we see what Llama3.1 8b instruct comes up with all on its own.'")
time_it(stream)

print("'This time we steer every 10 tokens, starting from the 7th (arbitrarily)'")
time_it(manual)


# output = tokenizer.decode(input_ids[0], skip_special_tokens=True)
# print(output)
