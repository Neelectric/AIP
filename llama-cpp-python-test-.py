

import llama_cpp
model = llama_cpp.Llama(
	# model_path="ggml-org/Meta-Llama-3.1-8B-Instruct-Q4_0-GGUF",
    model_path="/Users/s2011847/repos/llama.cpp/models/Meta-Llama-3.1-8B-Instruct-Q4_0-GGUF/meta-llama-3.1-8b-instruct-q4_0.gguf",
	# filename="GGUF_FILE",
    n_gpu_layers=-1,
)

print(model.create_chat_completion(
     messages=[{
         "role": "user",
         "content": "what is the meaning of life?"
     }],
    #  stream=True,
 ))