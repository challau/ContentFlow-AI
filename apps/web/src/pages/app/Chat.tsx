import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  CHAT_ACTIONS,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendMessage,
  type ChatAction,
  type ChatMessage,
  type Conversation,
} from '../../api/chat';

const ACTION_LABELS: Record<ChatAction, string> = {
  CHAT: '💬 Chat',
  REWRITE: '✍️ Rewrite',
  EXPAND: '⤢ Expand',
  SHORTEN: '⤡ Shorten',
  CHANGE_TONE: '🎭 Change tone',
  TRANSLATE: '🌐 Translate',
  IDEAS: '💡 Ideas',
};

/** Actions that operate on existing text rather than answering a question. */
const NEEDS_SOURCE: ChatAction[] = ['REWRITE', 'EXPAND', 'SHORTEN', 'CHANGE_TONE', 'TRANSLATE'];
const NEEDS_TARGET: ChatAction[] = ['CHANGE_TONE', 'TRANSLATE'];

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'USER';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-4)' }}>
      <div
        className="card"
        style={{
          maxWidth: '80%',
          padding: 'var(--space-4)',
          background: mine ? 'var(--primary-dim)' : 'var(--bg-glass)',
          borderColor: mine ? 'var(--primary)' : 'var(--border)',
        }}
      >
        {message.action !== 'CHAT' && (
          <div className="badge badge-muted" style={{ marginBottom: 'var(--space-2)' }}>
            {ACTION_LABELS[message.action]}
          </div>
        )}
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 'var(--text-sm)' }}>
          {message.content}
        </div>
        {message.sourceContent && (
          <details style={{ marginTop: 'var(--space-3)' }}>
            <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Source content
            </summary>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>
              {message.sourceContent}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [action, setAction] = useState<ChatAction>('CHAT');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    const res = await listConversations();
    setConversations(res.items);
    return res.items;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const items = await refreshList();
        if (items[0]) setActiveId(items[0].id);
      } catch (err) {
        toast((err as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshList, toast]);

  // Loads race each other and the send path, so only the newest one may write.
  const loadSeq = useRef(0);
  const loadMessages = useCallback(
    async (id: string | null) => {
      const seq = ++loadSeq.current;
      if (!id) { setMessages([]); return; }
      try {
        const c = await getConversation(id);
        if (seq === loadSeq.current) setMessages(c.messages ?? []);
      } catch (err) {
        if (seq === loadSeq.current) toast((err as Error).message, 'error');
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleNew() {
    try {
      const created = await createConversation();
      await refreshList();
      setActiveId(created.id);
      setMessages([]);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteConversation(id);
      const items = await refreshList();
      if (activeId === id) setActiveId(items[0]?.id ?? null);
      toast('Conversation deleted', 'info');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    let conversationId = activeId;
    setSending(true);
    try {
      if (!conversationId) {
        const created = await createConversation();
        conversationId = created.id;
        setMessages([]);
        setActiveId(created.id);
      }

      const res = await sendMessage(conversationId, {
        content: input,
        action,
        sourceContent: NEEDS_SOURCE.includes(action) && source.trim() ? source : undefined,
        target: NEEDS_TARGET.includes(action) && target.trim() ? target : undefined,
      });

      // Claim the sequence so any in-flight load cannot overwrite this.
      loadSeq.current++;
      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);
      setInput('');
      setSource('');
      await refreshList();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Assistant</h1>
          <p className="page-subtitle">Ask questions, rewrite content, and generate ideas</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ New chat</button>
      </div>

      <div className="chat-layout">
        {/* Conversation list */}
        <aside className="card chat-sidebar">
          {loading && <div className="empty-state"><div className="spinner" /></div>}
          {!loading && conversations.length === 0 && (
            <div style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              No conversations yet.
            </div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`chat-conversation ${c.id === activeId ? 'is-active' : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              <span className="chat-conversation-title">{c.title}</span>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Delete conversation"
                onClick={(e) => { e.stopPropagation(); void handleDelete(c.id); }}
              >
                ✕
              </button>
            </div>
          ))}
        </aside>

        {/* Thread */}
        <section className="card chat-thread">
          <div className="chat-messages">
            {messages.length === 0 && !sending && (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <div className="empty-state-title">Start a conversation</div>
                <div className="empty-state-desc">
                  Ask a question, or paste content and pick an action to rewrite, shorten or expand it.
                </div>
              </div>
            )}
            {messages.map((m) => <Bubble key={m.id} message={m} />)}
            {sending && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" /> Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSend} className="chat-composer">
            <div className="chat-actions">
              {CHAT_ACTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`badge ${a === action ? 'badge-primary' : 'badge-muted'}`}
                  style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => setAction(a)}
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>

            {NEEDS_SOURCE.includes(action) && (
              <textarea
                className="form-input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Paste the content to work on…"
                rows={3}
                required
              />
            )}

            {NEEDS_TARGET.includes(action) && (
              <input
                className="form-input"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={action === 'TRANSLATE' ? 'Target language, e.g. Spanish' : 'Target tone, e.g. professional'}
              />
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input
                className="form-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message…"
                required
              />
              <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
                {sending ? <div className="spinner" /> : 'Send'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
