## follow each steps properly to train ored ai in your own pc 

## install python 
Make sure you python version is 3.11 or 3.12 . if not download the latest python 

check your python version 
```
python --version
```
## clone the repository 
```
git clone https://github.com/Koe458-ui/oredlab.git
```
```
cd oredlab
```

Use git clone for the first time after that use 
```
git pull
```

## set up the repository 
```
cd ored/model
```
```
python -m venv .venv
```
```
.venv\Scripts\activate
```
```
pip install -r requirements.txt
```

## Switch to gpu (don't run ored model in cpu )
```
pip uninstall -y torch
```
```
pip install torch --index-url https://download.pytorch.org/whl/cu128
```

## Check for gpu 
```
nvidia-smi
```
```
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```
```
python scripts/pretrain.py --describe
```
```
python scripts/pretrain.py --probe-batch-size
```

The second line must print True. The last one tells you which batch size fits your GPU.

## Set your keys 
if you want to train on your own specific data and checkpoint 

For AWS (S3)
```
set "AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID"
set "AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY"
set "AWS_DEFAULT_REGION=YOUR_AWS_REGION"
set "AWS_STORAGE_BUCKET_NAME=YOUR_BUCKET_NAME"
```

For Microsoft Azure (blob storage)
```
set "AZURE_STORAGE_ACCOUNT=YOUR_STORAGE_ACCOUNT"
set "AZURE_STORAGE_KEY=YOUR_STORAGE_ACCOUNT_KEY"
set "AZURE_STORAGE_CONTAINER=YOUR_CONTAINER_NAME"
```

For Google cloud
```
set "GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json"
set "GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID"
set "GCS_BUCKET_NAME=YOUR_BUCKET_NAME"
```

for cloudflare 
```
set "ORED_R2_ACCOUNT_ID=YOUR_ACCOUNT_ID"
set "ORED_R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID"
set "ORED_R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY"
set "ORED_R2_BUCKET=YOUR_BUCKET_NAME"
```

for supabase 
```
set "ORED_SB_URL=YOUR_SUPABASE_URL"
set "ORED_SB_SERVICE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY"
```
## download the checkpoint and data
```
python scripts/checkpoints.py list
```
```
python scripts/checkpoints.py pull checkpoints/ored50m/best.pt --kind best --run-name ored50m
```
## Train 
```
python scripts/pretrain.py --resume --set training.device=cuda --set data.tokens.dataset_name=ored-data --set data.tokens.dataset_version=v1 --set data.tokens.tokenizer=data/tokenizer.json
```

## Save the checkpoint 
```
python scripts/checkpoints.py push checkpoints/ored50m/best.pt --kind best --run-name ored50m
```

