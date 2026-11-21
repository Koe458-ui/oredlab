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

The raw training files are in `ored-datasets` under `training data/`.

```
set "ORED_R2_ACCOUNT_ID=YOUR_ACCOUNT_ID"
set "ORED_R2_ACCESS_KEY_ID=YOUR_DATA_READ_ACCESS_KEY_ID"
set "ORED_R2_SECRET_ACCESS_KEY=YOUR_DATA_READ_SECRET_ACCESS_KEY"
set "ORED_R2_BUCKET=ored-datasets"
```

Create separate [R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/): an Object Read only token scoped to `ored-datasets`, an Object Read & Write token scoped to `ored-tokenized` for publishing, and an Object Read only token scoped to `ored-tokenized` for training. Use the first token for raw-data inspection and fetching. Keep every key local; never commit or upload keys to GitHub.

### Supabase

Put your supabase details :

```
set "ORED_SB_URL=SUPABASE_URL"
set "ORED_SB_SERVICE_KEY=YOUR_SERVICE_KEY"
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

A 250M checkpoint has not been published yet. Skip this step until one is uploaded. Then download it with:

```
python scripts/checkpoints.py pull checkpoints/ored250m/best.pt --kind best --run-name ored250m
```

This only works if ur Supabase already has the checkpoint saved. A new empty project won't have Ored's checkpoint in it.

## 8. Prepare the R2 data

Check the Parquet schema. This reads object metadata and small ranges; it does not download the full file:

```
python scripts/corpus.py r2-list --prefix "training data/"
python scripts/corpus.py r2-inspect "training data/eduknow_A.parquet"
python scripts/corpus.py r2-inspect "training data/tinystories.txt" --head-mb 1
```

Use the text field reported by `r2-inspect` below in place of `TEXT_FIELD`. The Parquet files total about 28.3 GB and the `.txt` object is separate. The following command downloads both, about 30 GB total, to your machine; run it only when you are ready to prepare the corpus:

```
python scripts/corpus.py r2-fetch --prefix "training data/" --out data/raw/eduknow
```

The `.txt` inspection reads at most 1 MB and reports counts for `<|endoftext|>`, blank lines, and line breaks without printing story text. Replace `TEXT_DELIMITER` below with the verified separator. Use `blank-line` for empty lines, `line` for one record per line, or the exact marker string for a custom separator.

## 9. Build and publish token shards

Train the 16,384-token tokenizer and create token shards from the downloaded Parquet and text files:

```
python scripts/corpus.py train-tokenizer --input data/raw/eduknow --text-field TEXT_FIELD --text-delimiter TEXT_DELIMITER --vocab-size 16384 --name ored250m --version v1 --out data/tokenizers/ored250m-v1.json
python scripts/corpus.py build-shards --input data/raw/eduknow --text-field TEXT_FIELD --text-delimiter TEXT_DELIMITER --tokenizer data/tokenizers/ored250m-v1.json --name eduknow --version v1 --out data/tokens/eduknow/v1/ored250m-v1
```

Switch to the Object Read & Write token scoped only to `ored-tokenized`, then publish the prepared shards:

```
set "ORED_R2_ACCESS_KEY_ID=YOUR_TOKENIZED_READ_WRITE_ACCESS_KEY_ID"
set "ORED_R2_SECRET_ACCESS_KEY=YOUR_TOKENIZED_READ_WRITE_SECRET_ACCESS_KEY"
set "ORED_R2_BUCKET=ored-tokenized"
python scripts/corpus.py publish --dir data/tokens/eduknow/v1/ored250m-v1 --name eduknow --version v1
```

The 250M config points to `eduknow` version `v1` and the matching tokenizer. On another PC, put the tokenizer artifact at `data/tokenizers/ored250m-v1.json`, switch to the Object Read only token for `ored-tokenized`, and start training; the token shards download to the ignored local `data/tokens` cache.

## 10. Train

Run this from the `ored/model` folder for a fresh 250M training run:

```
set "ORED_R2_ACCESS_KEY_ID=YOUR_TOKENIZED_READ_ACCESS_KEY_ID"
set "ORED_R2_SECRET_ACCESS_KEY=YOUR_TOKENIZED_READ_SECRET_ACCESS_KEY"
set "ORED_R2_BUCKET=ored-tokenized"
python scripts/pretrain.py --set training.device=cuda
```

Use `--resume` only to continue this 250M run. Training stops if the tokenizer, token shard manifest, or checkpoint is incompatible.

## 11. Save the checkpoint

When training is done, upload ur best checkpoint:

```
python scripts/checkpoints.py push checkpoints/ored250m/best.pt --kind best --run-name ored250m
```

Check it got saved:

```
