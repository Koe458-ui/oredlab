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


