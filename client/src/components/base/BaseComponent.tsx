import React from 'react';

/**
 * BaseComponent: Root abstract class component providing safe lifecycle management,
 * unmount guards, and interaction logging.
 */
export abstract class BaseComponent<P = {}, S = {}> extends React.Component<P, S> {
  protected _isMounted: boolean = false;

  componentDidMount(): void {
    this._isMounted = true;
  }

  componentWillUnmount(): void {
    this._isMounted = false;
  }

  /**
   * Safe state updater preventing memory leak warnings if the component has unmounted
   * during an in-flight asynchronous promise.
   */
  protected safeSetState<K extends keyof S>(
    state: ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null) | (Pick<S, K> | S | null),
    callback?: () => void
  ): void {
    if (this._isMounted) {
      this.setState(state as any, callback);
    }
  }

  protected logInteraction(action: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${this.constructor.name}] Interaction: ${action}`, metadata || '');
    }
  }
}

