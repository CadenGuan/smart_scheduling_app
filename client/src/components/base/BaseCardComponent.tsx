import React from 'react';
import { BaseComponent } from './BaseComponent';

export interface BaseCardState {
  isHovered: boolean;
  isFocused: boolean;
}

/**
 * BaseCardComponent: Abstract class component providing reusable hover/focus
 * elevation handlers and customizable event hooks.
 */
export abstract class BaseCardComponent<P = {}, S extends BaseCardState = BaseCardState> extends BaseComponent<P, S> {
  protected handleMouseEnter = (_event: React.MouseEvent<HTMLElement>): void => {
    this.safeSetState((prevState: any) => ({
      ...prevState,
      isHovered: true,
    }));
  };

  protected handleMouseLeave = (_event: React.MouseEvent<HTMLElement>): void => {
    this.safeSetState((prevState: any) => ({
      ...prevState,
      isHovered: false,
    }));
  };

  protected handleFocus = (_event: React.FocusEvent<HTMLElement>): void => {
    this.safeSetState((prevState: any) => ({
      ...prevState,
      isFocused: true,
    }));
  };

  protected handleBlur = (_event: React.FocusEvent<HTMLElement>): void => {
    this.safeSetState((prevState: any) => ({
      ...prevState,
      isFocused: false,
    }));
  };
}

