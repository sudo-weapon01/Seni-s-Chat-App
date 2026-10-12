'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatTime, formatDateTime, previewText } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { PresenceAvatar } from '@/components/Avatar';
import { AppHeader } from '@/components/AppHeader';

const EMOJI_OPTIONS = ['❤️', '👍', '😂', '🔥', '🎉', '😮'];

export function ChatApp() {
  const { user } = useAuth();
  const { socket, presence, setPresence } = useSocket();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get('c');

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // { id, senderUsername, body }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [error, setError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [activePickerId, setActivePickerId] = useState(null);

  const threadRef = useRef(null);
  const composerInputRef = useRef(null);
  const typingTimeout = useRef(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const filteredConversations = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.peer?.username?.toLowerCase().includes(q) ||
        c.lastMessage?.body?.toLowerCase().includes(q)
    );
  }, [conversations, filterQuery]);

  async function loadConversations() {
    try {
      const data = await api('/conversations');
      setConversations(data.conversations || []);
      const nextPresence = {};
      for (const c of data.conversations || []) {
        if (c.peer) nextPresence[c.peer.id] = Boolean(c.peer.online);
      }
      setPresence((prev) => ({ ...prev, ...nextPresence }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadMessages(conversationId) {
    try {
      const data = await api(`/conversations/${conversationId}/messages?limit=100`);
      setMessages(data.messages || []);
      await api(`/conversations/${conversationId}/read`, { method: 'POST' });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeId || !socket) return undefined;
    socket.emit('conversation:join', { conversationId: activeId });
    loadMessages(activeId);
    setReplyingTo(null);
    setEditingId(null);
    return () => {
      socket.emit('conversation:leave', { conversationId: activeId });
    };
  }, [activeId, socket]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, typingUsers, activeId]);

  function handleScroll() {
    if (!threadRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = threadRef.current;
    const isUp = scrollHeight - (scrollTop + clientHeight) > 180;
    setShowScrollBottom(isUp);
  }

  function scrollToBottom() {
    if (!threadRef.current) return;
    threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }

  useEffect(() => {
    if (!socket) return undefined;

    function onNew({ message }) {
      if (message.conversationId === activeId) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        api(`/conversations/${message.conversationId}/read`, { method: 'POST' }).catch(() => {});
      }
      loadConversations().catch(() => {});
    }

    function onEdited({ message }) {
      if (message.conversationId === activeId) {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      }
      loadConversations().catch(() => {});
    }

    function onDeleted({ message }) {
      if (message.conversationId === activeId) {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      }
      loadConversations().catch(() => {});
    }

    function onReceipt(payload) {
      if (payload.conversationId !== activeId) {
        loadConversations().catch(() => {});
        return;
      }
      setMessages((prev) =>
        prev.map((m) => {
          if (!payload.markedMessageIds.includes(m.id)) return m;
          const already = (m.readBy || []).some((r) => r.userId === payload.readerId);
          if (already) return m;
          return {
            ...m,
            readBy: [...(m.readBy || []), { userId: payload.readerId, readAt: payload.readAt }],
          };
        })
      );
      loadConversations().catch(() => {});
    }

    function onTyping({ conversationId, userId, username, typing }) {
      if (conversationId !== activeId || userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[userId] = username;
        else delete next[userId];
        return next;
      });
    }

    function onReaction({ messageId, reactions }) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    }

    socket.on('message:new', onNew);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('receipt:update', onReceipt);
    socket.on('typing:update', onTyping);
    socket.on('reaction:update', onReaction);

    return () => {
      socket.off('message:new', onNew);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('receipt:update', onReceipt);
      socket.off('typing:update', onTyping);
      socket.off('reaction:update', onReaction);
    };
  }, [socket, activeId, user?.id]);

  function emitTyping(on) {
    if (!socket || !activeId) return;
    socket.emit(on ? 'typing:start' : 'typing:stop', { conversationId: activeId });
  }

  function onDraftChange(value) {
    setDraft(value);
    emitTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 900);
  }

  async function sendMessage(e) {
    if (e) e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;
    setError('');
    const replyToId = replyingTo?.id || null;

    try {
      if (editingId) {
        const data = await api(`/messages/${editingId}`, { method: 'PATCH', body: { body } });
        setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)));
        setEditingId(null);
      } else {
        const data = await api(`/conversations/${activeId}/messages`, {
          method: 'POST',
          body: { body, replyToId },
        });
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
        setReplyingTo(null);
      }
      setDraft('');
      emitTyping(false);
      loadConversations().catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeMessage(id) {
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      await api(`/messages/${id}`, { method: 'DELETE' });
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(message) {
    setReplyingTo(null);
    setEditingId(message.id);
    setDraft(message.body);
    if (composerInputRef.current) composerInputRef.current.focus();
  }

  function startReply(message) {
    setEditingId(null);
    setReplyingTo({
      id: message.id,
      senderUsername: message.senderId === user?.id ? 'You' : (active?.peer?.username || 'Peer'),
      body: message.body,
    });
    if (composerInputRef.current) composerInputRef.current.focus();
  }

  function jumpToMessage(messageId) {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-pulse');
      setTimeout(() => el.classList.remove('highlight-pulse'), 1800);
    }
  }

  async function toggleReaction(messageId, emoji) {
    setActivePickerId(null);

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentReactions = m.reactions || [];
        const existing = currentReactions.find((r) => r.emoji === emoji);
        let nextReactions;
        if (existing) {
          if (existing.hasReacted) {
            if (existing.count <= 1) {
              nextReactions = currentReactions.filter((r) => r.emoji !== emoji);
            } else {
              nextReactions = currentReactions.map((r) =>
                r.emoji === emoji
                  ? {
                      ...r,
                      count: r.count - 1,
                      hasReacted: false,
                      users: (r.users || []).filter((u) => u !== user?.id),
                    }
                  : r
              );
            }
          } else {
            nextReactions = currentReactions.map((r) =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: r.count + 1,
                    hasReacted: true,
                    users: [...(r.users || []), user?.id],
                  }
                : r
            );
          }
        } else {
          nextReactions = [
            ...currentReactions,
            { emoji, count: 1, hasReacted: true, users: [user?.id] },
          ];
        }
        return { ...m, reactions: nextReactions };
      })
    );

    try {
      if (socket) {
        socket.emit('reaction:toggle', { messageId, emoji });
      } else {
        await api(`/messages/${messageId}/reactions`, { method: 'POST', body: { emoji } });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function showEditHistory(message) {
    try {
      const data = await api(`/messages/${message.id}/history`);
      setHistoryModal({ message, history: data.history || [] });
    } catch (err) {
      setError(err.message);
    }
  }

  function copyText(text, id) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 1800);
  }

  const typingLabel = Object.values(typingUsers).join(', ');

  return (
    <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <AppHeader />
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Filter chats…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="filter-input"
          />
          {filterQuery && (
            <button className="clear-btn" type="button" onClick={() => setFilterQuery('')}>
              ✕
            </button>
          )}
        </div>
        <div className="list">
          {filteredConversations.length === 0 ? (
            <div className="empty">
              {filterQuery ? 'No matching chats found.' : 'No conversations yet. Search people to start chatting!'}
            </div>
          ) : (
            filteredConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`list-item ${c.id === activeId ? 'active' : ''}`}
                onClick={() => {
                  setSidebarOpen(false);
                  router.push(`/chat?c=${c.id}`);
                }}
              >
                <PresenceAvatar user={c.peer} online={presence[c.peer?.id]} />
                <div className="item-main">
                  <div className="item-title">
                    <span className="name">{c.peer?.username || 'User'}</span>
                    <span className="meta">{formatTime(c.lastMessageAt || c.updatedAt)}</span>
                  </div>
                  <div className="preview">
                    {c.lastMessage?.deleted ? 'Message deleted' : previewText(c.lastMessage?.body)}
                  </div>
                </div>
                {c.unreadCount > 0 && c.id !== activeId ? <span className="badge">{c.unreadCount}</span> : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="chat">
        {active ? (
          <>
            <div className="chat-head">
              <div className="me-row">
                <button className="btn ghost mobile-only" type="button" onClick={() => setSidebarOpen(true)}>
                  ☰ Chats
                </button>
                <PresenceAvatar user={active.peer} online={presence[active.peer?.id]} />
                <div>
                  <Link className="name header-name" href={`/users/${active.peer?.id}`}>
                    {active.peer?.username}
                  </Link>
                  <div className="meta">
                    <span className={`status-indicator ${presence[active.peer?.id] ? 'online' : 'offline'}`} />
                    {presence[active.peer?.id] ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="error alert-bar">
                <span>{error}</span>
                <button type="button" className="close-btn" onClick={() => setError('')}>✕</button>
              </div>
            )}

            <div className="thread" ref={threadRef} onScroll={handleScroll}>
              {messages.length === 0 ? (
                <div className="empty-thread">
                  <div className="empty-icon">💬</div>
                  <h3>No messages yet</h3>
                  <p>Say hello to {active.peer?.username} and start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const mine = message.senderId === user?.id;
                  const seen = mine && (message.readBy || []).some((r) => r.userId !== user?.id);
                  const isCopied = copyFeedback === message.id;
                  const isPickerOpen = activePickerId === message.id;

                  return (
                    <div
                      key={message.id}
                      id={`msg-${message.id}`}
                      className={`bubble-row ${mine ? 'mine' : ''}`}
                    >
                      <div className={`bubble ${message.deleted ? 'deleted' : ''}`}>
                        {/* Quoted reply header */}
                        {message.replyTo && (
                          <div
                            className="reply-quote"
                            onClick={() => jumpToMessage(message.replyTo.id)}
                            title="Click to jump to quoted message"
                          >
                            <div className="reply-quote-sender">{message.replyTo.senderUsername}</div>
                            <div className="reply-quote-text">{previewText(message.replyTo.body, 60)}</div>
                          </div>
                        )}

                        <p>{message.deleted ? 'This message was deleted' : message.body}</p>

                        {/* Reactions Row */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="reactions-row">
                            {message.reactions.map((r) => (
                              <button
                                key={r.emoji}
                                type="button"
                                className={`reaction-pill ${r.hasReacted ? 'active' : ''}`}
                                onClick={() => toggleReaction(message.id, r.emoji)}
                                title={r.hasReacted ? 'Click to remove reaction' : 'Click to react'}
                              >
                                <span>{r.emoji}</span>
                                <span className="reaction-count">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="bubble-meta">
                          <span>{formatTime(message.createdAt)}</span>
                          {message.editedAt && !message.deleted && (
                            <button
                              type="button"
                              className="edit-badge-btn"
                              title="Click to view edit history"
                              onClick={() => showEditHistory(message)}
                            >
                              edited {formatTime(message.editedAt)}
                            </button>
                          )}
                          {mine && !message.deleted && (
                            <span className={`delivery-status ${seen ? 'seen' : 'sent'}`} title={seen ? 'Seen by recipient' : 'Delivered'}>
                              {seen ? '✓✓ Seen' : '✓ Sent'}
                            </span>
                          )}

                          {!message.deleted && (
                            <>
                              {/* Emoji reaction picker button */}
                              <div className="reaction-trigger-container">
                                <button
                                  className="btn ghost action-btn"
                                  type="button"
                                  title="Add reaction"
                                  onClick={() => setActivePickerId(isPickerOpen ? null : message.id)}
                                >
                                  ☺+
                                </button>
                                {isPickerOpen && (
                                  <div className="emoji-picker-popover">
                                    {EMOJI_OPTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className="emoji-btn"
                                        onClick={() => toggleReaction(message.id, emoji)}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Reply button */}
                              <button
                                className="btn ghost action-btn"
                                type="button"
                                title="Reply to message"
                                onClick={() => startReply(message)}
                              >
                                Reply
                              </button>

                              <button
                                className="btn ghost action-btn"
                                type="button"
                                title="Copy text"
                                onClick={() => copyText(message.body, message.id)}
                              >
                                {isCopied ? 'Copied!' : 'Copy'}
                              </button>
                            </>
                          )}

                          {mine && !message.deleted && (
                            <>
                              <button className="btn ghost action-btn" type="button" onClick={() => startEdit(message)}>
                                Edit
                              </button>
                              <button className="btn ghost action-btn danger-hover" type="button" onClick={() => removeMessage(message.id)}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {typingLabel && (
                <div className="typing-indicator">
                  <span className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>{typingLabel} is typing…</span>
                </div>
              )}
            </div>

            {showScrollBottom && (
              <button className="scroll-bottom-btn" type="button" onClick={scrollToBottom}>
                ↓ Latest
              </button>
            )}

            <form className="composer" onSubmit={sendMessage}>
              {/* Replying Banner */}
              {replyingTo && (
                <div className="reply-banner">
                  <div className="reply-banner-info">
                    <span className="reply-banner-title">Replying to {replyingTo.senderUsername}</span>
                    <span className="reply-banner-snippet">{previewText(replyingTo.body, 50)}</span>
                  </div>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setReplyingTo(null)}
                    title="Cancel reply"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Editing Banner */}
              {editingId && (
                <div className="editing-banner">
                  <span>Editing message</span>
                  <button
                    type="button"
                    className="cancel-edit-btn"
                    onClick={() => {
                      setEditingId(null);
                      setDraft('');
                    }}
                  >
                    Cancel (Esc)
                  </button>
                </div>
              )}

              <div className="composer-input-wrapper">
                <textarea
                  ref={composerInputRef}
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder={
                    editingId
                      ? 'Edit your message…'
                      : replyingTo
                      ? `Reply to ${replyingTo.senderUsername}…`
                      : `Message ${active.peer?.username || 'user'}…`
                  }
                  maxLength={4000}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                    } else if (e.key === 'Escape') {
                      if (editingId) {
                        setEditingId(null);
                        setDraft('');
                      } else if (replyingTo) {
                        setReplyingTo(null);
                      }
                    }
                  }}
                />
                <button className="btn send-btn" type="submit" disabled={!draft.trim()}>
                  {editingId ? 'Save' : 'Send'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="empty hero-empty">
            <button className="btn ghost mobile-only" type="button" onClick={() => setSidebarOpen(true)}>
              ☰ Open conversations
            </button>
            <div className="hero-badge">✨ Seni Real-Time Chat</div>
            <h2>Select a conversation</h2>
            <p>Your past 1-on-1 chats appear on the left sidebar. Search people to connect and message instantly.</p>
            <Link className="btn primary-gradient" href="/search">
              Find people to chat
            </Link>
          </div>
        )}
      </section>

      {/* Edit History Modal */}
      {historyModal && (
        <div className="modal-backdrop" onClick={() => setHistoryModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Message Edit History</h3>
              <button type="button" className="close-btn" onClick={() => setHistoryModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="history-item current">
                <div className="history-meta">
                  <span className="badge">Current</span>
                  <span>{formatDateTime(historyModal.message.editedAt || historyModal.message.createdAt)}</span>
                </div>
                <div className="history-text">{historyModal.message.body}</div>
              </div>
              {historyModal.history.length === 0 ? (
                <p className="muted">No earlier versions recorded.</p>
              ) : (
                historyModal.history.map((h, i) => (
                  <div key={h.id || i} className="history-item">
                    <div className="history-meta">
                      <span className="badge secondary">Version #{historyModal.history.length - i}</span>
                      <span>{formatDateTime(h.editedAt)}</span>
                    </div>
                    <div className="history-text">{h.previousBody}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
