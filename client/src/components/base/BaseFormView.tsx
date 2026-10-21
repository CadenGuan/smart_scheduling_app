import { BaseComponent } from './BaseComponent';

export interface BaseFormState {
  isSubmitting: boolean;
  errors: Record<string, string>;
}

/**
 * BaseFormView: Abstract class component extending BaseComponent,
 * providing reusable input change handlers and field-level validation helpers.
 */
export abstract class BaseFormView<P = {}, S extends BaseFormState = BaseFormState> extends BaseComponent<P, S> {
  protected handleInputChange = (field: string, value: any): void => {
    this.safeSetState((prevState: any) => ({
      ...prevState,
      formData: {
        ...(prevState.formData || {}),
        [field]: value,
      },
      errors: {
        ...(prevState.errors || {}),
        [field]: '',
      },
    }) as any);
  };

  protected setFieldError = (field: string, errorMessage: string): void => {
    this.safeSetState((prevState: any) => ({
      ...prevState,
      errors: {
        ...(prevState.errors || {}),
        [field]: errorMessage,
      },
      isSubmitting: false,
    }) as any);
  };

  protected clearErrors = (): void => {
    this.safeSetState((prevState: any) => ({
      ...prevState,
      errors: {},
    }) as any);
  };
}
