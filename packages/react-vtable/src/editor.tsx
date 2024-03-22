import type { ComponentType, ReactNode, ReactPortal, RefAttributes } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { createElement, Fragment, useEffect, useReducer } from 'react';
import type { EditContext, IEditor } from '@visactor/vtable-editors';
import ReactDOM from 'react-dom';
import type { Root } from 'react-dom/client';

export function createEditor<T>({ render }: CreateEditorOption<T>): ReactEditor<T> {
  let requestReRender: (() => void) | undefined;
  const portals = new Set<ReactPortal>();

  function Holder() {
    const update = useReducer(() => ({}), {})[1];

    useEffect(() => {
      requestReRender = update;
      return () => {
        requestReRender = void 0;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return Array.from(portals, (portal, index) => <Fragment key={index}>{portal}</Fragment>);
  }

  function onStart(context: EditContext) {
    const { top, left, width, height } = context.referencePosition.rect;
    let { value } = context;
    if (!render) {
      return () => value;
    }

    let componentRef: ReactEditorRenderRef | null | undefined;
    const renderTarget = (
      <div style={{ top, left, width, height, position: 'relative' }}>
        {createElement(render, {
          context,
          ref: v => (componentRef = v),
          onChange: v => (value = v)
        })}
      </div>
    );

    function onEnd(event?: Event): T | undefined {
      componentRef?.onEnd?.(event);
      if (event?.defaultPrevented) {
        // @ts-expect-error
        return;
      }
      return value;
    }

    if (requestReRender) {
      const portal = ReactDOM.createPortal(renderTarget, context.container);
      portals.add(portal);
      requestReRender();
      return (e?: Event) => {
        const result = onEnd(e);
        if (e.defaultPrevented) {
          // @ts-expect-error
          return;
        }
        portals.delete(portal);
        requestReRender?.();
        return result;
      };
    }

    if (+ReactDOM.version.split('.')[0] >= 18) {
      // @ts-expect-error it does exist
      // eslint-disable-next-line no-undef
      const root = ReactDOM.createRoot(document.createDocumentFragment()) as Root;
      root.render(renderTarget);
      return (e?: Event) => {
        const result = onEnd(e);
        if (e?.defaultPrevented) {
          // @ts-expect-error
          return;
        }
        root.unmount();
        return result;
      };
    }
    // eslint-disable-next-line no-undef
    const node = document.createDocumentFragment();
    ReactDOM.render(renderTarget, node);
    return (e?: Event) => {
      const result = onEnd(e);
      if (e?.defaultPrevented) {
        // @ts-expect-error
        return;
      }
      ReactDOM.unmountComponentAtNode(node);
      return result;
    };
  }

  return { onStart, Holder };
}

export interface CreateEditorOption<T> {
  render?: ComponentType<ReactEditorRenderProps<T> & RefAttributes<ReactEditorRenderRef | undefined | null>>;
}

export interface ReactEditorRenderProps<T> {
  defaultValue?: T;
  onChange: (value: T) => void;
  context: EditContext<T>;
}

export interface ReactEditorRenderRef {
  onEnd?: (e?: Event) => void;
}

export interface ReactEditor<T> extends Pick<IEditor<T>, 'onStart'> {
  Holder: () => ReactNode;
}
