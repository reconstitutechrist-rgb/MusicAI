import { useState, useCallback, useMemo } from "react";
import { ValidationResult } from "../utils/validation";

export interface FieldConfig<T> {
  initialValue: T;
  validator?: (value: T) => ValidationResult;
  required?: boolean;
}

export interface FieldState<T> {
  value: T;
  error: string | null;
  touched: boolean;
  isDirty: boolean;
}

export interface FormState<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string | null>>;
  touched: Partial<Record<keyof T, boolean>>;
  isDirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
}

export interface FormActions<T extends Record<string, unknown>> {
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: Partial<T>) => void;
  setError: <K extends keyof T>(field: K, error: string | null) => void;
  setTouched: <K extends keyof T>(field: K, touched?: boolean) => void;
  validateField: <K extends keyof T>(field: K) => boolean;
  validateAll: () => boolean;
  reset: (newValues?: Partial<T>) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  handleBlur: <K extends keyof T>(field: K) => () => void;
  handleChange: <K extends keyof T>(field: K) => (value: T[K]) => void;
}

export interface UseFormStateOptions<T extends Record<string, unknown>> {
  initialValues: T;
  validators?: Partial<Record<keyof T, (value: unknown) => ValidationResult>>;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  onSubmit?: (values: T) => void | Promise<void>;
}

export function useFormState<T extends Record<string, unknown>>(
  options: UseFormStateOptions<T>
): [FormState<T>, FormActions<T>] {
  const {
    initialValues,
    validators = {} as Partial<Record<keyof T, (value: unknown) => ValidationResult>>,
    validateOnBlur = true,
    validateOnChange = false,
  } = options;

  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
  const [touched, setTouchedState] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setSubmitting] = useState(false);

  // Calculate isDirty by comparing current values to initial values
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  // Calculate isValid by checking all validators
  const isValid = useMemo(() => {
    for (const key of Object.keys(validators) as Array<keyof T>) {
      const validator = validators[key];
      if (validator) {
        const result = validator(values[key]);
        if (!result.isValid) return false;
      }
    }
    return true;
  }, [values, validators]);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));

    // Validate on change if enabled
    if (validateOnChange) {
      const validator = validators[field];
      if (validator) {
        const result = validator(value);
        setErrors((prev) => ({ ...prev, [field]: result.isValid ? null : result.error }));
      }
    } else {
      // Clear error when value changes (will re-validate on blur)
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  }, [validators, validateOnChange]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  const setError = useCallback(<K extends keyof T>(field: K, error: string | null) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const setTouched = useCallback(<K extends keyof T>(field: K, isTouched = true) => {
    setTouchedState((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const validateField = useCallback(<K extends keyof T>(field: K): boolean => {
    const validator = validators[field];
    if (!validator) return true;

    const result = validator(values[field]);
    setErrors((prev) => ({ ...prev, [field]: result.isValid ? null : result.error }));
    return result.isValid;
  }, [values, validators]);

  const validateAll = useCallback((): boolean => {
    let allValid = true;
    const newErrors: Partial<Record<keyof T, string | null>> = {};

    for (const key of Object.keys(validators) as Array<keyof T>) {
      const validator = validators[key];
      if (validator) {
        const result = validator(values[key]);
        newErrors[key] = result.isValid ? null : result.error || null;
        if (!result.isValid) allValid = false;
      }
    }

    setErrors(newErrors);

    // Mark all fields as touched
    const allTouched: Partial<Record<keyof T, boolean>> = {};
    for (const key of Object.keys(values) as Array<keyof T>) {
      allTouched[key] = true;
    }
    setTouchedState(allTouched);

    return allValid;
  }, [values, validators]);

  const reset = useCallback((newValues?: Partial<T>) => {
    setValuesState(newValues ? { ...initialValues, ...newValues } : initialValues);
    setErrors({});
    setTouchedState({});
    setSubmitting(false);
  }, [initialValues]);

  const handleBlur = useCallback(<K extends keyof T>(field: K) => () => {
    setTouched(field, true);
    if (validateOnBlur) {
      validateField(field);
    }
  }, [setTouched, validateOnBlur, validateField]);

  const handleChange = useCallback(<K extends keyof T>(field: K) => (value: T[K]) => {
    setValue(field, value);
  }, [setValue]);

  const state: FormState<T> = {
    values,
    errors,
    touched,
    isDirty,
    isValid,
    isSubmitting,
  };

  const actions: FormActions<T> = {
    setValue,
    setValues,
    setError,
    setTouched,
    validateField,
    validateAll,
    reset,
    setSubmitting,
    handleBlur,
    handleChange,
  };

  return [state, actions];
}

/**
 * Simple single-field state hook
 */
export function useFieldState<T>(
  initialValue: T,
  validator?: (value: T) => ValidationResult
): {
  value: T;
  error: string | null;
  touched: boolean;
  isDirty: boolean;
  setValue: (value: T) => void;
  setTouched: (touched?: boolean) => void;
  validate: () => boolean;
  reset: (newValue?: T) => void;
  handleBlur: () => void;
  handleChange: (value: T) => void;
} {
  const [value, setValueState] = useState<T>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouchedState] = useState(false);

  const isDirty = useMemo(() => {
    return JSON.stringify(value) !== JSON.stringify(initialValue);
  }, [value, initialValue]);

  const setValue = useCallback((newValue: T) => {
    setValueState(newValue);
    // Clear error on change
    if (error) setError(null);
  }, [error]);

  const setTouched = useCallback((isTouched = true) => {
    setTouchedState(isTouched);
  }, []);

  const validate = useCallback((): boolean => {
    if (!validator) return true;
    const result = validator(value);
    setError(result.isValid ? null : result.error || null);
    return result.isValid;
  }, [value, validator]);

  const reset = useCallback((newValue?: T) => {
    setValueState(newValue ?? initialValue);
    setError(null);
    setTouchedState(false);
  }, [initialValue]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    validate();
  }, [setTouched, validate]);

  const handleChange = useCallback((newValue: T) => {
    setValue(newValue);
  }, [setValue]);

  return {
    value,
    error,
    touched,
    isDirty,
    setValue,
    setTouched,
    validate,
    reset,
    handleBlur,
    handleChange,
  };
}

export default useFormState;
