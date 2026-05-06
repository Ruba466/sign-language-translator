import pickle
import numpy as np

with open("model/final_dataset.pkl", "rb") as f:
    data = pickle.load(f)

print("Keys:", list(data.keys()))
print("sequence_length:", data.get("sequence_length"))
print("num_features:", data.get("num_features"))
print("num_classes:", data.get("num_classes"))
print("camera_flip:", data.get("camera_flip"))

X_train = data.get("X_train")
print("\nX_train shape:", X_train.shape)
print("X_train sample[0][0]:", X_train[0][0][:10])  # first 10 values of first frame

y_train = data.get("y_train")
print("y_train sample:", y_train[:5])

idx_to_word = data.get("idx_to_word")
word_to_idx = data.get("word_to_idx")
print("idx_to_word:", idx_to_word)