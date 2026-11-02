import { useState } from "react";
export function useForm<T extends Record<string, string>>(
  initial: T,
  validator: (values: T) => Partial<Record<keyof T, string>>,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  function setField<K extends keyof T>(key: K, value: T[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((v) => ({ ...v, [key]: undefined }));
  }
  function validate() {
    const next = validator(values);
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  return { values, errors, setField, validate };
}
