import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, RefreshCw } from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Tabs } from '../../components/ui/Tabs';
import { ConversationList } from '../../components/messages/ConversationList';
import { ChatThread } from '../../components/messages/ChatThread';
import { NotificationFeed } from '../../components/messages/NotificationFeed';
import { ClientDrawer } from '../../components/clients/ClientDrawer';
import { useSettings } from '../../context/SettingsContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import type {
  ConversationDetailPayload,
  ConversationListPayload,
  ConversationSummary,
  MessageChannel,
  NotificationFeedPayload,
  NotificationItem
} from '../../types';

const EMPTY_COUNTS = { all: 0, unread: 0, unanswered: 0 };

export function MessagesPage() {
  const { branding } = useSettings();
  const { subscribe, badges, refreshBadges } = useRealtime();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState<'chats' | 'feed'>('chats');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState('all');
  const [list, setList] = useState<ConversationListPayload | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);

  const [feed, setFeed] = useState<NotificationFeedPayload | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedKind, setFeedKind] = useState('all');
  const [feedFilter, setFeedFilter] = useState<'all' | 'unread'>('all');
  const [marking, setMarking] = useState(false);

  const seq = useRef(0);
  const detailSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const listQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('filter', filter);
    params.set('limit', '60');
    if (debounced) params.set('q', debounced);
    return params.toString();
  }, [filter, debounced]);

  const loadList = useCallback(
    async (silent = false) => {
      const id = ++seq.current;
      if (!silent) setListLoading(true);
      try {
        const data = await api.get<ConversationListPayload>(`/messages/conversations?${listQuery()}`);
        if (id !== seq.current) return;
        setList(data);
      } catch (err) {
        if (id !== seq.current) return;
        if (!silent) toast({ title: 'Не удалось загрузить диалоги', variant: 'error' });
      } finally {
        if (id === seq.current) setListLoading(false);
      }
    },
    [listQuery, toast]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openConversation = useCallback(
    async (id: number) => {
      const seqId = ++detailSeq.current;
      setActiveId(id);
      setDetailLoading(true);
      setSendError(null);
      try {
        const data = await api.get<ConversationDetailPayload>(`/messages/conversations/${id}`);
        if (seqId !== detailSeq.current) return;
        setDetail(data);
        setDetailError(null);
        const unread = data.conversation.unread;
        if (unread > 0) {
          await api.post(`/messages/conversations/${id}/read`);
          if (seqId === detailSeq.current) {
            setDetail((prev) =>
              prev
                ? {
                    ...prev,
                    messages: prev.messages.map((message) => ({ ...message, isRead: true })),
                    conversation: { ...prev.conversation, unread: 0 }
                  }
                : prev
            );
          }
          void refreshBadges();
          void loadList(true);
        }
      } catch (err) {
        if (seqId !== detailSeq.current) return;
        setDetailError(err instanceof ApiError ? err.message : 'Не удалось открыть диалог');
        setDetail(null);
      } finally {
        if (seqId === detailSeq.current) setDetailLoading(false);
      }
    },
    [loadList, refreshBadges]
  );

  /* Живые события: новое сообщение и созданный диалог. */
  useEffect(() => {
    const offMessage = subscribe('message', (payload) => {
      const data = payload as { conversationId?: number };
      if (!data?.conversationId) return;
      void loadList(true);
      if (data.conversationId === activeId) {
        void api
          .get<ConversationDetailPayload>(`/messages/conversations/${data.conversationId}`)
          .then((next) => {
            if (next.conversation.id === activeId) setDetail(next);
          })
          .catch(() => undefined);
      }
    });
    const offConversation = subscribe('conversation', () => void loadList(true));
    return () => {
      offMessage();
      offConversation();
    };
  }, [subscribe, loadList, activeId]);

  const send = async (body: string, channel: MessageChannel) => {
    if (!activeId) return false;
    setSending(true);
    setSendError(null);
    try {
      const data = await api.post<{ message: ConversationDetailPayload['messages'][number] }>(
        `/messages/conversations/${activeId}/send`,
        { body, channel }
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages.filter((item) => item.id !== data.message.id), data.message],
              conversation: { ...prev.conversation, channel }
            }
          : prev
      );
      void loadList(true);
      return true;
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Сообщение не отправлено');
      return false;
    } finally {
      setSending(false);
    }
  };

  const loadFeed = useCallback(
    async (silent = false) => {
      if (!silent) setFeedLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '40');
        params.set('filter', feedFilter);
        if (feedKind !== 'all') params.set('kind', feedKind);
        const data = await api.get<NotificationFeedPayload>(`/notifications?${params.toString()}`);
        setFeed(data);
      } catch {
        if (!silent) toast({ title: 'Не удалось загрузить уведомления', variant: 'error' });
      } finally {
        setFeedLoading(false);
      }
    },
    [feedFilter, feedKind, toast]
  );

  useEffect(() => {
    if (view !== 'feed') return;
    void loadFeed();
  }, [view, loadFeed]);

  useEffect(() => {
    if (view !== 'feed') return;
    return subscribe('notification', () => void loadFeed(true));
  }, [view, subscribe, loadFeed]);

  const openNotification = async (item: NotificationItem) => {
    setFeed((prev) =>
      prev
        ? { ...prev, items: prev.items.map((entry) => (entry.id === item.id ? { ...entry, isRead: 1 } : entry)) }
        : prev
    );
    try {
      await api.post(`/notifications/${item.id}/read`);
      void refreshBadges();
    } catch {
      /* без уведомления */
    }
    if (item.actionUrl) navigate(item.actionUrl);
  };

  const readAll = async () => {
    setMarking(true);
    try {
      await api.post('/notifications/read-all');
      await loadFeed(true);
      void refreshBadges();
      toast({ title: 'Все уведомления прочитаны', variant: 'success', duration: 2600 });
    } catch {
      toast({ title: 'Не удалось обновить уведомления', variant: 'error' });
    } finally {
      setMarking(false);
    }
  };

  const counts = list?.counts || EMPTY_COUNTS;
  const items = list?.items || [];

  const tabs = useMemo(
    () => [
      { id: 'chats', label: 'Диалоги', icon: MessageSquare, count: counts.unread || undefined },
      { id: 'feed', label: 'Уведомления', icon: Bell, count: badges.unreadNotifications || undefined }
    ],
    [counts.unread, badges.unreadNotifications]
  );

  const activeSummary = items.find((item) => item.id === activeId) || detail?.conversation || null;

  return (
    <div className="page messages-page" data-thread={activeId !== null || undefined}>
      <PageHead
        title="Сообщения"
        subtitle={
          view === 'chats'
            ? `${counts.all} диалогов · ${counts.unread} непрочитанных · ${counts.unanswered} ждут ответа`
            : 'Заявки, сообщения, отзывы и системные события — всё в одной ленте'
        }
        actions={
          <button
            type="button"
            className="btn btn--icon btn--bordered"
            onClick={() => (view === 'chats' ? void loadList() : void loadFeed())}
            aria-label="Обновить"
          >
            <RefreshCw />
          </button>
        }
      />

      <Tabs items={tabs} value={view} onChange={(id) => setView(id as 'chats' | 'feed')} className="messages-tabs" />

      {view === 'chats' ? (
        <div className="msg-shell" data-open={activeId !== null || undefined}>
          <aside className="msg-shell__list">
            <ConversationList
              items={items}
              activeId={activeId}
              loading={listLoading}
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={(value) => {
                setFilter(value);
                setList(null);
                setListLoading(true);
              }}
              counts={counts}
              onOpen={(item: ConversationSummary) => void openConversation(item.id)}
            />
          </aside>

          <ChatThread
            detail={detail}
            loading={detailLoading}
            sending={sending}
            error={sendError || detailError}
            timezone={branding.timezone}
            currencySymbol={branding.currencySymbol}
            decimalSeparator={branding.decimalSeparator}
            onSend={send}
            onBack={() => {
              setActiveId(null);
              setDetail(null);
            }}
            onOpenClient={(id) => setClientId(id)}
            onOpenBooking={(code) => navigate(`/b/${code}`)}
          />

          {activeSummary && (
            <aside className="msg-side">
              <div className="msg-side__card">
                <span className="msg-side__label">Клиент</span>
                <b className="msg-side__name">{activeSummary.client?.name}</b>
                <div className="msg-side__rows">
                  {activeSummary.client?.phone && (
                    <a href={`tel:${activeSummary.client.phone.replace(/[^\d+]/g, '')}`}>
                      {activeSummary.client.phone}
                    </a>
                  )}
                  {activeSummary.client?.email && (
                    <a href={`mailto:${activeSummary.client.email}`}>{activeSummary.client.email}</a>
                  )}
                  {activeSummary.client?.telegram && (
                    <a
                      href={`https://t.me/${activeSummary.client.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{activeSummary.client.telegram.replace('@', '')}
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--soft btn--sm btn--block"
                  onClick={() => activeSummary.client && setClientId(activeSummary.client.id)}
                >
                  Открыть карточку
                </button>
              </div>

              <div className="msg-side__stats">
                <div>
                  <em>Сообщений</em>
                  <b className="tnum">{activeSummary.total}</b>
                </div>
                <div>
                  <em>Непрочитанных</em>
                  <b className="tnum">{activeSummary.unread}</b>
                </div>
                <div>
                  <em>Записи</em>
                  <b>{activeSummary.hasBooking ? 'есть' : 'нет'}</b>
                </div>
              </div>
            </aside>
          )}
        </div>
      ) : (
        <NotificationFeed
          data={feed}
          loading={feedLoading}
          kind={feedKind}
          onKind={(value) => {
            setFeedKind(value);
            setFeedLoading(true);
          }}
          filter={feedFilter}
          onFilter={(value) => {
            setFeedFilter(value);
            setFeedLoading(true);
          }}
          onOpen={(item) => void openNotification(item)}
          onReadAll={() => void readAll()}
          marking={marking}
        />
      )}

      <ClientDrawer
        clientId={clientId}
        currencySymbol={branding.currencySymbol}
        decimalSeparator={branding.decimalSeparator}
        onClose={() => setClientId(null)}
        onChanged={() => void loadList(true)}
      />
    </div>
  );
}
