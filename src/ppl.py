# Let's train a Sum Pretrained Transformer
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

def compute_ppl(model, sequence):
    return