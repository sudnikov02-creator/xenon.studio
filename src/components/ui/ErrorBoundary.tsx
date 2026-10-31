import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[xenon.studio] UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="statuspage">
        <div className="statuspage__card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <BrandMark size={46} />
          </div>
          <div className="statuspage__icon">
            <TriangleAlert />
          </div>
          <h1 className="statuspage__title">Что-то пошло не так</h1>
          <p className="statuspage__text">
            Интерфейс столкнулся с неожиданной ошибкой. Обновите страницу — данные студии сохранены и никуда не
            пропали.
          </p>
          <div className="statuspage__actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Обновить страницу
            </button>
            <a className="btn" href="/">
              На главную
            </a>
          </div>
          <div className="statuspage__hint">xenon.studio · студия фотографа</div>
        </div>
      </div>
    );
  }
}
