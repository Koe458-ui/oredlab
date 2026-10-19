# Train Ored AI on your own PC

Ok so this is how u train Ored on ur own PC. Do everything in CMD (Command Prompt) and keep the same CMD window open till training is done, otherwise ur keys and settings get lost and u have to set them again.

## 1. Install Python

Get Python 3.11 or 3.12. Just make sure `python` works in CMD.

Check it:

```
python --version
```

## 2. Get the repo

First time only, clone it:

```
git clone https://github.com/Koe458-ui/oredlab.git
cd oredlab
```

Already have it? Just go inside the folder and pull the latest file aka repo :

```
git pull
```

## 3. Set up everything

Go into the model folder and make a virtual env. This keeps Ored's packages away from ur other projects so nothing breaks.

```
cd ored/model
python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 4. Switch to GPU

By default pip gives u the CPU version of PyTorch, which is way too slow for training. So remove it and put the GPU one. U need an NVIDIA GPU for this.

```
python -m pip uninstall -y torch
python -m pip install torch --index-url https://download.pytorch.org/whl/cu128
```

If this one doesn't work on ur PC, go to the [PyTorch site](https://pytorch.org/get-started/locally/) and copy the command for ur setup.
Important: make sure you run on gpu (don't skip this part)

## 5. Check ur GPU

Run these one by one to make sure the GPU is actually working:

```
nvidia-smi
```

```
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'No CUDA GPU detected')"
```

```
python scripts/pretrain.py --describe
```

```
python scripts/pretrain.py --probe-batch-size --set training.device=cuda
```

U should see `True` and ur GPU name. The last one tells u which batch sizes fit in ur GPU memory. It just shows u, it doesn't change anything by itself.

## 6. Add ur keys

Training files are should be in AWS S3 / MICROSOFT AZURE/ GOOGLE CLOUD/ Cloudflare R2 / supabase the checkpoint details should also be in vice versa 

### AWS S3

Put ur AWS details here :
```
set "ORED_R2_ENDPOINT=Put ur end point here (e.g https://s3.ap-south-1.amazonaws.com)"
set "ORED_R2_REGION=Put ur region here (e.g ap_southeast-1"
set "ORED_R2_ACCESS_KEY_ID=AWS_ACCESS_KEY_ID"
set "ORED_R2_SECRET_ACCESS_KEY=AWS_SECRET_ACCESS_KEY"
set "ORED_R2_BUCKET=S3_BUCKET"
```

### Azure Blob storage 

Currently not supported (will be available in future)

### Google cloud storage 

Put ur GCS details here :

```
set "ORED_R2_ENDPOINT=https://storage.googleapis.com"
set "ORED_R2_ACCESS_KEY_ID=GCS_HMAC_ACCESS_ID"
set "ORED_R2_SECRET_ACCESS_KEY=GCS_HMAC_SECRET"
set "ORED_R2_BUCKET=GCS_BUCKET"
```

### R2

Put ur R2 details here:

```
set "ORED_R2_ACCOUNT_ID=ACCOUNT_ID"
set "ORED_R2_ACCESS_KEY_ID=ACCESS_KEY_ID"
set "ORED_R2_SECRET_ACCESS_KEY=SECRET_ACCESS_KEY"
set "ORED_R2_BUCKET=DATA_BUCKET"
```

### Supabase

Put your supabase details :

```
set "ORED_SB_URL=SUPABASE_URL"
set "ORED_SB_SERVICE_KEY=SUPABASE_SERVICE_ROLE_KEY"
```

### Checkpoint bucket

This is the bucket where checkpoints go. If u skip it, it uses `ored-checkpoints`.

```
set "ORED_SB_CHECKPOINT_BUCKET=YOUR_CHECKPOINT_BUCKET"
```

If ur data and checkpoints are in the same bucket, just use the same name for both. If not, make sure both buckets exist and ur keys can access them.

**Important:** never put ur real keys on GitHub. Also these keys only stay in this CMD window, close it and they're gone.

## 7. Download the checkpoint

See what checkpoints u have:

```
python scripts/checkpoints.py list
```

Download the best one for `ored50m`:

```
python scripts/checkpoints.py pull checkpoints/ored50m/best.pt --kind best --run-name ored50m
```

This only works if ur Supabase already has the checkpoint saved. A new empty project won't have Ored's checkpoint in it.

## 8. Check tokenizer and data

Make sure the tokenizer file is there:

```
dir data\tokenizer.json
```

U have to get `data/tokenizer.json` separately, it doesn't download by itself. And it has to be the same tokenizer that was used to make the dataset, otherwise training won't work. The dataset (`ored-data`, version `v1`) downloads from R2 by itself when u start training, as long as it's there in the right folder.

## 9. Train

Run this from the `ored/model` folder once everything above is done:

```
python scripts/pretrain.py --resume --set training.device=cuda --set data.tokens.dataset_name=ored-data --set data.tokens.dataset_version=v1 --set data.tokens.tokenizer=data/tokenizer.json
```

`--resume` means it continues from the best checkpoint u downloaded. If something is missing or doesn't match (checkpoint, dataset, tokenizer or keys), it will just stop with an error.

## 10. Save the checkpoint

When training is done, upload ur best checkpoint:

```
python scripts/checkpoints.py push checkpoints/ored50m/best.pt --kind best --run-name ored50m
```

Check it got saved:

```
python scripts/checkpoints.py list --run ored50m
```

This uploads it once. It doesn't keep uploading by itself while training, so do this every time u finish.
