// TODO: Validate
export async function readGmValue<StoredValue>(valueKey: string): Promise<StoredValue | undefined> {
  return GM.getValue<StoredValue | undefined>(valueKey, undefined);
}

// TODO: Validate
export async function writeGmValue(valueKey: string, storedValue: Tampermonkey.StorageValue): Promise<void> {
  if (storedValue === null || storedValue === undefined) {
    await GM.deleteValue(valueKey);
    return;
  }
  await GM.setValue(valueKey, storedValue);
}

// TODO: Validate
export function listenForGmValueChange(valueKey: string, onValueChanged: (newValue: unknown) => void): () => void {
  const valueChangeListenerId = GM_addValueChangeListener(valueKey, (_changedKey, _oldValue, newValue) =>
    onValueChanged(newValue),
  );
  return () => GM_removeValueChangeListener(valueChangeListenerId);
}
