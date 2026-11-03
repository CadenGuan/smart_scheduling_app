import React from 'react';

/**
 * BaseComponent: Root abstract class component providing safe lifecycle management,
 * unmount guards, and interaction logging.
 */
export abstract class BaseComponent<P = {}, S = {}> extends React.Component<P, S> {
  protected _isMounted: boolean = false;
  protected _hasUnmounted: boolean = false;

  componentDidMount(): void {
    this._isMounted = true;
    this._hasUnmounted = false;
  }

  componentWillUnmount(): void {
    this._isMounted = false;
    this._hasUnmounted = true;
  }

  /**
   * Safe state updater preventing memory leak warnings if the component has unmounted
   * during an in-flight asynchronous promise.
   */
  protected safeSetState<K extends keyof S>(
    state:
      | ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null)
      | (Pick<S, K> | S | null),
    callback?: () => void
  ): void {
    if (this._hasUnmounted) return;

    const nextPartial =
      typeof state === 'function' ? (state as any)(this.state, this.props) : state;
    if (nextPartial) {
      this.state = Object.assign({}, this.state, nextPartial);
    }

    const isFiberMounted =
      typeof (this as any).updater?.isMounted === 'function'
        ? (this as any).updater.isMounted(this)
        : this._isMounted;

    if (this._isMounted && isFiberMounted) {
      this.setState(state as any, callback);
    } else if (callback) {
      callback();
    }
  }

  protected logInteraction(action: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${this.constructor.name}] Interaction: ${action}`, metadata || '');
    }
  }
}
