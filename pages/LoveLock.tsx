import {ConnectionScreen} from '../components/ConnectionScreen';
import { ReactionChips } from '../components/ReactionChips';
import { useAppMotion } from '../hooks/useAppMotion';
import { springs, motionTransition, newlyAppended, type MessageStamp } from '../lib/motion';
import { MotionPortal } from '../components/ui/MotionPortal';
import { AppIcon } from '../components/ui/Icons';
import { loadChatMedia } from '../lib/media';
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCouples } from '../contexts/CouplesContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, animate, useMotionValue } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import Toast from '../components/Toast';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { decryptBlob } from '../lib/encryption';

import { AudioPlayer } from '../components/ui/AudioPlayer';
import { AudioRecorder } from '../components/AudioRecorder';
import { SecureImage, SecureAudio } from '../components/SecureMedia';
import { generateLoveNote, AI_MOODS, AIMood } from '../lib/ai';
import { Shield, Phone, Video, EllipsisVertical } from '../components/ui/Icons';
import { useCall } from '../contexts/CallContext';
import { SecurityVerification } from '../components/SecurityVerification';
import MessageContextMenu, { MessageAction } from '../components/MessageContextMenu';
import type { SharedNote } from '../types';


// Check if running natively (Capacitor)
const isNative = () => {
    try {
        return (window as any).Capacitor?.isNativePlatform?.() ?? false;
    } catch { return false; }
};

const LoveLock: React.FC = () => {
    const navigate = useNavigate(); // Added navigate
    const {
        couple, notes, isLoading, createNote, retryNote, chatConnected,
        addReaction, replyToNote, markAsRead, setIsChatOpen, uploadMedia,
        isSupporter, partnerProfile, disconnectCouple, hasMoreNotes,
        loadingOlder, loadOlderNotes, partnerPubKey,
        isSyncRequired,
        toggleStar, togglePin, deleteNote, forwardNote
    } = useCouples();
    const { user } = useAuth();
    const { theme } = useTheme();
    const { reduced } = useAppMotion();
    const { initiateCall } = useCall();

    const [noteContent, setNoteContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emojiPickerNoteId, setEmojiPickerNoteId] = useState<string | null>(null);
    const [showRecorder, setShowRecorder] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
      noteId: string;
      x: number;
      y: number;
      anchor: 'left' | 'right';
    } | null>(null);

    // Reply state: which note we're replying to
    const [replyToNote_id, setReplyToNoteId] = useState<string | null>(null);
    const replyNote = replyToNote_id ? notes.find(n => n.id === replyToNote_id) : null;

    // Message info modal
    const [messageInfoNote, setMessageInfoNote] = useState<SharedNote | null>(null);

    // Confirmation dialog state (replaces native confirm() which crashes native WebViews)
    const [confirmDialog, setConfirmDialog] = useState<{
      title: string;
      message: string;
      onConfirm: () => void;
      confirmLabel?: string;
      cancelLabel?: string;
    } | null>(null);

    // View mode: 'all' | 'starred' | 'pinned'
    const [viewFilter, setViewFilter] = useState<'all' | 'starred' | 'pinned'>('all');

    // Multi-select mode
    const [selectMode, setSelectMode] = useState(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

    // Long press timer for mobile
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-resize textarea (WhatsApp-style: grows upward)
    const autoResizeTextarea = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto'; // Reset to auto to measure scrollHeight
        el.style.height = Math.min(el.scrollHeight, 128) + 'px'; // Cap at max-h-32 (128px)
    };

    // AI Love Note state
    const [showAISheet, setShowAISheet] = useState(false);
    const [aiMood, setAIMood] = useState<AIMood | null>(null);
    const [aiCustomPrompt, setAICustomPrompt] = useState('');
    const [showSecurity, setShowSecurity] = useState(false);
    const [aiGenerating, setAIGenerating] = useState(false);

    // GIF Picker state
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifSearch, setGifSearch] = useState('');
    const [gifResults, setGifResults] = useState<any[]>([]);
    const [gifLoading, setGifLoading] = useState(false);
    const gifSearchTimeout = useRef<NodeJS.Timeout | null>(null);

    // GIPHY API — key must be set via VITE_GIPHY_API_KEY env variable
    const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '';

    const searchGifs = async (query: string) => {
        if (gifLoading || !GIPHY_API_KEY) return;
        setGifLoading(true);
        try {
            const endpoint = query.trim()
                ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13`
                : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg-13`;
            const res = await fetch(endpoint);
            const data = await res.json();
            setGifResults(data.data || []);
        } catch (e) {
            console.error('GIF search failed', e);
        } finally {
            setGifLoading(false);
        }
    };

    // Load trending GIFs when picker opens
    useEffect(() => {
        if (showGifPicker && gifResults.length === 0) {
            searchGifs('');
        }
    }, [showGifPicker]);

    const handleGifSearchChange = (val: string) => {
        setGifSearch(val);
        if (gifSearchTimeout.current) clearTimeout(gifSearchTimeout.current);
        gifSearchTimeout.current = setTimeout(() => searchGifs(val), 400);
    };

    const handleSendGif = async (gifUrl: string) => {
        setShowGifPicker(false);
        setGifSearch('');
        setIsSubmitting(true);
        try {
        // DB constraint updated to support 'gif'
        await createNote('GIF', 'gif', gifUrl);
        scrollToBottom();
        } catch (error) {
            console.error(error);
            showToast('Error', 'Failed to send GIF', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Link detection helper
    const URL_REGEX = /(https?:\/\/[^\s]+)/;
    const hasLinks = (text: string) => URL_REGEX.test(text);

    const renderMessageContent = (text: string, isMe: boolean) => {
        const parts = text.split(URL_REGEX);
        const urlMatches = text.match(URL_REGEX);

        if (!urlMatches || urlMatches.length === 0) {
            return <p className="whitespace-pre-wrap leading-relaxed text-[15px] break-words">{text}</p>;
        }

        return (
            <div>
                <p className="whitespace-pre-wrap leading-relaxed text-[15px] break-words">
                    {parts.map((part, i) =>
                        URL_REGEX.test(part) ? (
                            <a
                                key={i}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`underline underline-offset-2 ${isMe ? 'text-white/90 hover:text-white' : 'text-blue-500 hover:text-blue-600'}`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {part.length > 40 ? part.slice(0, 40) + '…' : part}
                            </a>
                        ) : (
                            <span key={i}>{part}</span>
                        )
                    )}
                </p>
                {/* Link action bar */}
                <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${isMe ? 'border-white/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <a
                        href={urlMatches[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                            isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="app-icon-glyph text-[13px]"><AppIcon name={"open_in_new"}/></span>
                        Open
                    </a>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(urlMatches[0]);
                            showToast('Copied!', 'Link copied to clipboard');
                        }}
                        className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                            isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                    >
                        <span className="app-icon-glyph text-[13px]"><AppIcon name={"content_copy"}/></span>
                        Copy
                    </button>
                </div>
            </div>
        );
    };

    // Available emojis for reactions
    const reactionEmojis = ['❤️', '😍', '😂', '😢', '😮', '🔥', '👍', '💋', '🥰', '😘', '💕', '✨'];

    // Toast State
    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({
        isVisible: false,
        message: '',
        type: 'success'
    });

    const showToast = (message: string, subMessage?: string, type: 'success' | 'error' = 'success') => {
        setToast({ isVisible: true, message, subMessage, type });
    };

    const closeToast = () => {
        setToast(prev => ({ ...prev, isVisible: false }));
    };

    // For auto-scrolling
    const notesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const previousMessages = useRef<{ coupleId: string; notes: MessageStamp[] } | null>(null);
    const playedEntrances = useRef(new Set<string>());
    const scrollValue = useMotionValue(0);
    const scrollAnimation = useRef<ReturnType<typeof animate> | null>(null);
    const scrollingAutomatically = useRef(false);
    const loadingPage = useRef(false);
    const freshMessages = useMemo(() => newlyAppended(previousMessages.current?.notes || [], notes, !isLoading && previousMessages.current?.coupleId === couple?.id), [notes, isLoading, couple?.id]);
    const stopAutoScroll = () => { scrollAnimation.current?.stop(); scrollingAutomatically.current = false; };
    useEffect(() => () => scrollAnimation.current?.stop(), []);

    const isAdmin = user?.role === 'admin';

    // Pairing mode toggle — both roles can generate or enter

    // Track if chat is open + cleanup timers on unmount
    useEffect(() => {
        setIsChatOpen(true);
        return () => {
            setIsChatOpen(false);
            if (gifSearchTimeout.current) clearTimeout(gifSearchTimeout.current);
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        };
    }, []);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
             if (emojiPickerNoteId) {
                 setEmojiPickerNoteId(null);
             }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [emojiPickerNoteId]);

    // Track which note IDs we've already marked as read to avoid flooding Supabase
    const markedAsReadRef = useRef<Set<string>>(new Set());
    const [visibilityRevision,setVisibilityRevision]=useState(0);
    useEffect(()=>{
        const visible=()=>{if(document.visibilityState==='visible')setVisibilityRevision(value=>value+1);};
        document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
        return()=>{document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};
    },[]);

    // Mark messages as read when viewing
    useEffect(() => {
        if (!user || !notes?.length) return;

        // Find messages sent by partner that are not yet read AND not already marked
        const unreadNotes = notes
            .filter(n => !n.content.startsWith('🔐') && document.visibilityState==='visible' && n.sender_id !== user.id && n.status !== 'read' && !markedAsReadRef.current.has(n.id))
            .map(n => n.id);

        if (unreadNotes.length > 0) {
            unreadNotes.forEach(id => markedAsReadRef.current.add(id));
            void markAsRead(unreadNotes).catch(()=>{unreadNotes.forEach(id=>markedAsReadRef.current.delete(id));});
        }
    }, [notes, user, visibilityRevision]);

    const loadEarlierMessages = async () => {
        const el = chatContainerRef.current;
        if (!el || loadingOlder || loadingPage.current || !hasMoreNotes) return;
        const prevHeight = el.scrollHeight;
        const prevTop = el.scrollTop;
        loadingPage.current = true;
        try {
            await loadOlderNotes();
            requestAnimationFrame(() => {
                if (chatContainerRef.current === el) el.scrollTop = prevTop + el.scrollHeight - prevHeight;
            });
        } catch {
            showToast('Could not load earlier messages', 'Please retry.', 'error');
        } finally {
            loadingPage.current = false;
        }
    };

    const handleChatScroll = () => {
        const el = chatContainerRef.current;
        if (!el) return;

        // Check if user is near bottom (within 50px threshold)
        const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        if (!scrollingAutomatically.current) isAtBottomRef.current = isBottom;

        if (loadingOlder || loadingPage.current || !hasMoreNotes || scrollingAutomatically.current) return;
        if (el.scrollTop < 80) void loadEarlierMessages();
    };

    useLayoutEffect(() => {
        if (isLoading || couple?.status !== 'active') return;
        const first = !previousMessages.current || previousMessages.current.coupleId !== couple.id;
        if (first) playedEntrances.current.clear();
        // Consume arrivals even when a filter hides them or motion is disabled.
        // Revealing them later is history navigation, not a new message arrival.
        else for (const id of freshMessages) playedEntrances.current.add(id);
        previousMessages.current = { coupleId: couple.id, notes: notes.map(({ id, created_at }) => ({ id, created_at })) };
        if (first) scrollToBottom(true);
        else if (freshMessages.size && (isAtBottomRef.current || notes.some(note => freshMessages.has(note.id) && note.sender_id === user?.id))) scrollToBottom();
    }, [notes, isLoading, couple?.id, freshMessages, user?.id]);

    useEffect(()=>{
        setNoteContent('');setSelectedImage(null);setReplyToNoteId(null);
        setMessageInfoNote(null);setContextMenu(null);setShowRecorder(false);
    },[couple?.id]);

    function scrollToBottom(immediate = false) {
        const el = chatContainerRef.current;
        if (!el) return;
        const target = Math.max(0, el.scrollHeight - el.clientHeight);
        scrollAnimation.current?.stop();
        if (reduced || immediate) {
            scrollValue.jump(target); el.scrollTop = target; scrollingAutomatically.current = false; isAtBottomRef.current = true;
            return;
        }
        if (!scrollingAutomatically.current) scrollValue.jump(el.scrollTop);
        scrollingAutomatically.current = true;
        scrollAnimation.current = animate(scrollValue, target, { ...springs.section, onUpdate: value => { el.scrollTop = value; }, onComplete: () => { scrollingAutomatically.current = false; isAtBottomRef.current = true; } });
    }



    const handleAudioSend = async (blob: Blob) => {
        setShowRecorder(false);
        setIsSubmitting(true);
        try {
            const audioFile = new File([blob], "voice_message.webm", { type: 'audio/webm' });
            const mediaUrl = await uploadMedia(audioFile);
            await createNote('Voice Message', 'audio', mediaUrl);
            scrollToBottom();
        } catch (error) {
             console.error(error);
             showToast('Error', 'Failed to send audio', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePickImage = async () => {
        // On native, use Capacitor Camera plugin
        if (isNative()) {
            try {
                const image = await Camera.getPhoto({
                    quality: 80,
                    allowEditing: false,
                    resultType: CameraResultType.Uri,
                    source: CameraSource.Prompt
                });

                if (image.webPath) {
                    const response = await fetch(image.webPath);
                    const blob = await response.blob();
                    const file = new File([blob], `image_${Date.now()}.${image.format}`, { type: blob.type });

                    setIsSubmitting(true);
                    showToast('Uploading...', 'Please wait', 'success');

                    try {
                        const mediaUrl = await uploadMedia(file);
                        await createNote('Image', 'image', mediaUrl);
                        scrollToBottom();
                        showToast('Sent!', 'Image uploaded successfully');
                    } catch (error) {
                        console.error(error);
                        showToast('Error', 'Failed to upload image', 'error');
                    } finally {
                        setIsSubmitting(false);
                    }
                }
            } catch (error) {
                if (String(error).includes('cancelled')) return;
                console.error('Camera error:', error);
                showToast('Error', 'Could not access camera/photos', 'error');
            }
        } else {
            // On browser, use file input fallback
            fileInputRef.current?.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so same file can be selected again
        e.target.value = '';

        setIsSubmitting(true);
        showToast('Uploading...', 'Please wait', 'success');
        try {
            const mediaUrl = await uploadMedia(file);
            await createNote('Image', 'image', mediaUrl);
            scrollToBottom();
            showToast('Sent!', 'Image uploaded successfully');
        } catch (error) {
            console.error(error);
            showToast('Error', 'Failed to upload image', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // AI Love Note Generator
    const handleAIGenerate = async () => {
        if (!aiMood) return;
        setAIGenerating(true);
        try {
            const result = await generateLoveNote(aiMood, aiCustomPrompt.trim() || undefined);
            if (result.error) {
                showToast('AI Error', result.error, 'error');
            } else {
                setNoteContent(result.text);
                setShowAISheet(false);
                setAIMood(null);
                setAICustomPrompt('');
            }
        } catch (error) {
            showToast('Error', 'Failed to generate message', 'error');
        } finally {
            setAIGenerating(false);
        }
    };

    const handleDownloadImage = async (url: string) => {
        const toastId = showToast('Downloading...', 'Please wait', 'success');
        try {
            const blob = url.includes('giphy.com')
                ? await (await fetch(url)).blob()
                : await loadChatMedia(url, partnerPubKey);
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `love_lock_${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            showToast('Saved!', 'Image saved to gallery');
        } catch (error) {
            console.error('Download failed', error);
            showToast('Error', 'Failed to download image', 'error');

        }
    };

    // Removed old recording functions (replaced by AudioRecorder component)

    // --- Context menu helpers ---
    const openContextMenu = useCallback((noteId: string, x: number, y: number, isMe: boolean) => {
      if (navigator.vibrate) navigator.vibrate(30);
      setContextMenu({ noteId, x, y, anchor: isMe ? 'right' : 'left' });
    }, []);

    const handleLongPressStart = useCallback((noteId: string, isMe: boolean) => (e: React.TouchEvent) => {
      const touch = e.touches[0];
      longPressTimerRef.current = setTimeout(() => {
        openContextMenu(noteId, touch.clientX, touch.clientY, isMe);
      }, 500);
    }, [openContextMenu]);

    const handleLongPressEnd = useCallback(() => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }, []);

    const handleContextMenuEvent = useCallback((noteId: string, isMe: boolean) => (e: React.MouseEvent) => {
      e.preventDefault();
      openContextMenu(noteId, e.clientX, e.clientY, isMe);
    }, [openContextMenu]);

    const getContextMenuNote = () => contextMenu ? notes.find(n => n.id === contextMenu.noteId) : null;

    const buildMenuActions = useCallback((): MessageAction[] => {
      const note = getContextMenuNote();
      if (!note || !user) return [];
      const isMe = note.sender_id === user.id;
      const isStarred = note.starred_by?.includes(user.id) ?? false;
      const isPinned = note.pinned_by?.includes(user.id) ?? false;
      const isTextMsg = note.type === 'text';

      return [
        {
          icon: 'info',
          label: 'Message info',
          onClick: () => setMessageInfoNote(note),
        },
        {
          icon: 'reply',
          label: 'Reply',
          onClick: () => {
            setReplyToNoteId(note.id);
            textareaRef.current?.focus();
          },
        },
        {
          icon: 'content_copy',
          label: 'Copy',
          hidden: !isTextMsg,
          onClick: () => {
            navigator.clipboard.writeText(note.content);
            showToast('Copied', 'Message copied to clipboard');
          },
        },
        {
          icon: 'forward',
          label: 'Forward',
          onClick: async () => {
            try {
              await forwardNote(note.id);
              showToast('Forwarded', 'Message forwarded');
              scrollToBottom();
            } catch {
              showToast('Error', 'Failed to forward', 'error');
            }
          },
        },
        {
          icon: isPinned ? 'keep_off' : 'keep',
          label: isPinned ? 'Unpin' : 'Pin',
          onClick: async () => {
            try {
              await togglePin(note.id);
              showToast(isPinned ? 'Unpinned' : 'Pinned', isPinned ? 'Message unpinned' : 'Message pinned');
            } catch {
              showToast('Error', 'Failed to update pin', 'error');
            }
          },
        },
        {
          icon: isStarred ? 'star' : 'star_border',
          label: isStarred ? 'Unstar' : 'Star',
          onClick: async () => {
            try {
              await toggleStar(note.id);
            } catch {
              showToast('Error', 'Failed to update star', 'error');
            }
          },
        },
        {
          icon: 'checklist',
          label: 'Select',
          onClick: () => {
            setSelectMode(true);
            setSelectedNoteIds(new Set([note.id]));
          },
        },
        {
          icon: 'delete',
          label: isMe ? 'Delete' : 'Delete for me',
          danger: true,
          onClick: () => {
            if (isMe) {
              // Show sub-options: for me / for everyone
              setConfirmDialog({
                title: 'Delete Message',
                message: 'Delete for everyone?',
                confirmLabel: 'For Everyone',
                cancelLabel: 'For Me Only',
                onConfirm: () => {
                  deleteNote(note.id, true).catch(() => showToast('Error', 'Failed to delete', 'error'));
                },
              });
            } else {
              deleteNote(note.id, false).catch(() => showToast('Error', 'Failed to delete', 'error'));
            }
          },
        },
      ];
    }, [contextMenu, notes, user]);

    // Handle sending text with reply-to support
    const handleSendText = async () => {
        if (!noteContent.trim() || isSubmitting) return;
        if(isSyncRequired){window.dispatchEvent(new CustomEvent('recheck-lockdown'));return;}
        const draft=noteContent;setNoteContent('');
        setIsSubmitting(true);
        try {
            await createNote(draft, 'text', undefined, replyToNote_id || undefined);
            setReplyToNoteId(null);
            // Reset textarea height after sending
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            scrollToBottom();
        } catch (error) {
             console.error(error);
             if(!(error as {queued?:boolean})?.queued)setNoteContent(current=>current?draft+'\n'+current:draft);
             showToast('Message not sent', (error as {queued?:boolean})?.queued?'Your encrypted message is saved. Tap Retry messages.':error instanceof Error?error.message:'Please retry.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Multi-select bulk delete
    const handleBulkDelete = async () => {
      if (selectedNoteIds.size === 0) return;
      for (const id of selectedNoteIds) {
        try { await deleteNote(id, false); } catch { /* continue */ }
      }
      setSelectMode(false);
      setSelectedNoteIds(new Set());
      showToast('Deleted', `${selectedNoteIds.size} message(s) deleted`);
    };

    // Filter notes based on view filter
    const filteredNotes = viewFilter === 'all'
      ? notes
      : viewFilter === 'starred'
        ? notes.filter(n => n.starred_by?.includes(user?.id ?? '') ?? false)
        : notes.filter(n => n.pinned_by?.includes(user?.id ?? '') ?? false);

     const handleReaction = async (noteId: string, emoji: string) => {
         try {
             await addReaction(noteId, emoji);
         } catch(error) {
             console.error(error);
         }
     }

    if (isLoading) {
         return <div className="p-8 text-center opacity-50">Loading our space...</div>;
    }

    // Updated Disconnect Logic
    const handleDisconnect = async () => {
        setConfirmDialog({
            title: 'Disconnect',
            message: 'Are you sure you want to disconnect? All messages, reactions, games and shared attachments will be permanently deleted for both of you. Personal health logs stay with their owner. Reconnecting starts a new conversation.',
            confirmLabel: 'Disconnect',
            onConfirm: async () => {
                try {
                    const result=await disconnectCouple();
                    showToast('Disconnected', result.mediaDeleted?'Your shared conversation and attachments have been deleted.':'Your shared conversation has been deleted. Attachment cleanup is queued and will retry automatically.');
                } catch (error) {
                    showToast('Error', error instanceof Error ? error.message : 'Failed to disconnect', 'error');
                }
            },
        });
    };

    // Stage 1: Initial Pairing — both roles can generate or enter
    if (!couple || couple.status === 'pending') return <ConnectionScreen/>;

    // STATE: Active (Chat Interface) — couple is paired and active, show chat directly
    return (
        <div className="reference-chat bloom-chat flex flex-col h-full max-h-full relative overflow-hidden bg-background-dark">
             {/* Header - Fixed at top */}
            <div className="bloom-chat-header relative z-30 shrink-0 bg-white/80 dark:bg-background-dark/80 backdrop-blur-xl border-b dark:border-white/5 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/20 overflow-hidden border-2 border-primary/20">
                        {partnerProfile?.avatar_url ? (
                            <img src={partnerProfile.avatar_url} alt="Partner" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary font-bold">
                                {partnerProfile?.full_name?.charAt(0) || 'P'}
                            </div>
                        )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                        <h3 className="text-sm font-bold truncate max-w-[120px]">
                            {partnerProfile?.full_name || 'Partner'}
                        </h3>
                        <div className="flex items-center gap-1">
                            {isSyncRequired || notes.some(n => n.content?.includes('🔐 Message locked')) ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <span
                                        onClick={() => window.dispatchEvent(new CustomEvent('recheck-lockdown'))}
                                        className="text-[10px] text-amber-500 font-bold uppercase tracking-wider cursor-pointer hover:underline"
                                    >
                                        Restore chats
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{chatConnected?'Connected · encrypted':'Reconnecting…'}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-full border dark:border-white/5">
                    <button
                        onClick={() => setViewFilter(viewFilter === 'starred' ? 'all' : 'starred')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                          viewFilter === 'starred' ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'text-gray-500 dark:text-gray-400 hover:text-amber-500 hover:bg-white dark:hover:bg-white/10'
                        }`}
                        title="Starred messages"
                    >
                        <span className="app-icon-glyph text-[20px]"><AppIcon name={viewFilter === 'starred' ? 'star' : 'star_border'}/></span>
                    </button>
                    <button
                        onClick={() => initiateCall(false)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-green-500 hover:bg-white dark:hover:bg-white/10 transition-all active:scale-90"
                        title="Voice Call"
                    >
                        <Phone className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => initiateCall(true)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-white dark:hover:bg-white/10 transition-all active:scale-90"
                        title="Video Call"
                    >
                        <Video className="w-5 h-5" />
                    </button>
                    <div className="w-[1px] h-4 bg-gray-200 dark:bg-white/10 mx-0.5" />
                    <button
                            onClick={() => setShowSecurity(true)}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-white dark:hover:bg-white/10 transition-all active:scale-90"
                            title="Security Verification"
                    >
                        <Shield className="w-4 h-4" />
                    </button>
                    <button
                            onClick={handleDisconnect}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-white/10 transition-all active:scale-90"
                            title="Disconnect"
                    >
                        <span className="app-icon-glyph text-[20px]"><AppIcon name={"link_off"}/></span>
                    </button>
                </div>
                <div className="flex items-center gap-1 md:hidden">
                    <button aria-label="Voice call" onClick={() => initiateCall(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/10"><Phone size={19}/></button>
                    <button aria-label="Video call" onClick={() => initiateCall(true)} className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/10"><Video size={21}/></button>
                    <details className="bloom-chat-menu relative">
                        <summary aria-label="Chat options" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-gray-500 hover:bg-primary/10"><EllipsisVertical size={20}/></summary>
                        <div onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')} className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-surface-dark p-2 shadow-medium">
                            <button onClick={() => setViewFilter(viewFilter === 'starred' ? 'all' : 'starred')} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-primary/10">{viewFilter === 'starred' ? 'All messages' : 'Starred messages'}</button>
                            <button onClick={() => setShowSecurity(true)} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-primary/10">Verify encryption</button>
                            <button onClick={handleDisconnect} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm text-red-600 hover:bg-red-500/10">Disconnect partner</button>
                        </div>
                    </details>
                </div>
            </div>

            {/* Notes List - Adjusted padding for fixed header */}
            <div
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                onWheel={stopAutoScroll}
                onTouchStart={stopAutoScroll}
                onPointerDown={stopAutoScroll}
                className="reference-chat-messages flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4"
            >
                {/* View filter bar */}
                {viewFilter !== 'all' && (
                  <div className="flex items-center justify-between bg-white dark:bg-surface-dark rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <span className="app-icon-glyph text-[16px]"><AppIcon name={viewFilter === 'starred' ? 'star' : 'keep'}/></span>
                      {viewFilter === 'starred' ? 'Starred messages' : 'Pinned messages'}
                      <span className="ml-1 text-pink-500 font-mono">{filteredNotes.length}</span>
                    </span>
                    <button onClick={() => setViewFilter('all')} className="text-xs text-pink-500 font-bold hover:underline">Show all</button>
                  </div>
                )}

                {/* Select mode bar */}
                {selectMode && (
                  <div className="flex items-center justify-between bg-white dark:bg-surface-dark rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      {selectedNoteIds.size} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={handleBulkDelete} className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1">
                        <span className="app-icon-glyph text-[14px]"><AppIcon name={"delete"}/></span>
                        Delete
                      </button>
                      <button onClick={() => { setSelectMode(false); setSelectedNoteIds(new Set()); }} className="text-xs text-gray-400 font-bold hover:underline">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Pinned messages preview - Sticky at top */}
                {viewFilter === 'all' && (() => {
                  const pinnedNotes = notes.filter(n => n.pinned_by?.includes(user?.id ?? '') ?? false);
                  if (pinnedNotes.length === 0) return null;
                  return (
                    <button
                      onClick={() => setViewFilter('pinned')}
                      className="sticky top-0 z-10 w-full flex items-center gap-2 bg-amber-50/95 dark:bg-amber-500/15 backdrop-blur-sm text-amber-700 dark:text-amber-400 rounded-xl px-3 py-2 border border-amber-200 dark:border-amber-500/20 mb-2 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors shadow-sm"
                    >
                      <span className="app-icon-glyph text-[16px]"><AppIcon name={"keep"}/></span>
                      {pinnedNotes.length} pinned message{pinnedNotes.length > 1 ? 's' : ''}
                    </button>
                  );
                })()}

                {/* Load older messages indicator */}
                {hasMoreNotes && viewFilter === 'all' && (
                    <div className="text-center py-2">
                        {loadingOlder ? (
                            <span className="text-xs text-gray-400 animate-pulse">Loading older messages...</span>
                        ) : (
                            <button onClick={() => void loadEarlierMessages()} className="text-xs text-pink-400 hover:text-pink-500 transition-colors">
                                <AppIcon name="arrow_upward" size={14}/> Load older messages
                            </button>
                        )}
                    </div>
                )}
                {filteredNotes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                        <span className="app-icon-glyph text-4xl mb-2"><AppIcon name={viewFilter !== 'all' ? (viewFilter === 'starred' ? 'star_border' : 'keep_off') : 'edit_note'}/></span>
                        <p>{viewFilter !== 'all' ? `No ${viewFilter} messages` : 'Write your first note...'}</p>
                    </div>
                ) : (
                    filteredNotes.map((note) => {
                        const isMe = note.sender_id === user?.id;
                        const isImage = (note.type === 'image' || note.type === 'gif') && note.media_url;
                        const isStarred = note.starred_by?.includes(user?.id ?? '') ?? false;
                        const isPinned = note.pinned_by?.includes(user?.id ?? '') ?? false;
                        const isSelected = selectedNoteIds.has(note.id);

                        // Find the original note being replied to
                        const repliedNote = note.reply_to_id ? notes.find(n => n.id === note.reply_to_id) : null;

                        return (
                            <motion.div
                                key={note.id}
                                initial={!reduced && freshMessages.has(note.id) && !playedEntrances.current.has(note.id) ? { opacity: .65, y: isMe ? 26 : 14, x: isMe ? 8 : -5, scale: .95 } : false}
                                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                                transition={{ ...motionTransition(springs.message, reduced), opacity: { duration: reduced ? 0 : .12 } }}
                                style={{ transformOrigin: isMe ? 'right bottom' : 'left bottom' }}
                                onAnimationStart={() => { if (freshMessages.has(note.id)) playedEntrances.current.add(note.id); }}
                                className={`chat-message-row flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'} ${isSelected ? 'ring-2 ring-pink-500 rounded-2xl' : ''}`}
                                onClick={() => {
                                  if (selectMode) {
                                    setSelectedNoteIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(note.id)) next.delete(note.id);
                                      else next.add(note.id);
                                      return next;
                                    });
                                  }
                                }}
                            >
                                <div
                                    onContextMenu={handleContextMenuEvent(note.id, isMe)}
                                    onTouchStart={handleLongPressStart(note.id, isMe)}
                                    onTouchEnd={handleLongPressEnd}
                                    onTouchMove={handleLongPressEnd}
                                    data-kind={isImage ? 'media' : 'text'} className={`reference-message-bubble ${isMe ? 'is-mine' : ''} relative max-w-[85%] group ${
                                    isImage
                                        ? 'rounded-2xl overflow-hidden'
                                        : isMe
                                            ? 'on-brand bg-primary text-white rounded-2xl rounded-br-sm shadow-sm'
                                            : 'bg-white dark:bg-surface-dark text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-bl-sm shadow-sm'
                                }`}>
                                    {/* Forwarded label */}
                                    {note.is_forwarded && (
                                      <div className={`flex items-center gap-1 px-4 pt-2 pb-0 text-[10px] italic ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                        <span className="app-icon-glyph text-[12px]"><AppIcon name={"forward"}/></span>
                                        Forwarded
                                      </div>
                                    )}

                                    {/* Reply-to preview */}
                                    {repliedNote && (
                                      <div className={`mx-2 mt-2 mb-0 px-3 py-1.5 rounded-lg border-l-[3px] ${
                                        isMe
                                          ? 'bg-white/10 border-white/40'
                                          : 'bg-gray-100 dark:bg-white/5 border-pink-400'
                                      }`}>
                                        <p className={`text-[10px] font-bold ${isMe ? 'text-white/70' : 'text-pink-500'}`}>
                                          {repliedNote.sender_id === user?.id ? 'You' : (partnerProfile?.full_name?.split(' ')[0] || 'Partner')}
                                        </p>
                                        <p className={`text-[11px] truncate max-w-[200px] ${isMe ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                                          {repliedNote.type === 'audio' ? '🎙 Voice message' : repliedNote.type === 'image' ? '📷 Photo' : repliedNote.type === 'gif' ? 'GIF' : repliedNote.content}
                                        </p>
                                      </div>
                                    )}

                                    {!isImage ? (
                                        <div className="px-4 py-2.5">
                                            {note.type === 'audio' && note.media_url ? (
                                                <SecureAudio src={note.media_url} partnerPubKey={partnerPubKey} isMe={isMe} />
                                            ) : (
                                                renderMessageContent(note.content, isMe)
                                            )}
                                            <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 opacity-70 ${isMe ? 'text-white/80' : 'text-gray-400'}`}>
                                                {isStarred && <span className="app-icon-glyph text-[12px] text-amber-400"><AppIcon name={"star"}/></span>}
                                                {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {isMe && (
                                                    <span className={`app-icon-glyph text-[14px] ${
                                                        note.status === 'read'
                                                            ? 'text-[#53bdeb] font-bold'
                                                            : note.status === 'delivered'
                                                                ? 'text-white/70'
                                                                : 'text-white/50'
                                                    }`}><AppIcon data-receipt={note.status} name={note.localStatus==='sending'?'schedule':note.localStatus==='failed'?'error_outline':note.status === 'sent' ? 'check' : 'done_all'}/></span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {note.type === 'gif' ? (
                                                <div className="relative group/media">
                                                    {note.media_url?.startsWith('http') ? (
                                                        <img
                                                            src={note.media_url}
                                                            alt="GIF"
                                                            className="block max-w-full w-auto h-auto max-h-80 object-contain cursor-pointer"
                                                            onClick={() => setSelectedImage(note.media_url)}
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-40 bg-gray-100 dark:bg-white/5 flex flex-col items-center justify-center gap-2">
                                                            <span className="app-icon-glyph text-gray-400"><AppIcon name={"lock"}/></span>
                                                            <span className="text-[10px] text-gray-400">Encrypted Media</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <SecureImage
                                                    src={note.media_url}
                                                    partnerPubKey={partnerPubKey}
                                                    alt="Shared image"
                                                    className="block max-w-full w-auto h-auto max-h-80 object-contain cursor-pointer"
                                                    onClick={() => setSelectedImage(note.media_url)}
                                                />
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 pt-8 bg-gradient-to-t from-black/60 to-transparent flex justify-end items-center gap-1">
                                                <span className="text-[10px] text-white/90 font-medium">
                                                    {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isMe && (
                                                    <span className={`app-icon-glyph text-[14px] ${
                                                        note.status === 'read'
                                                            ? 'text-[#53bdeb] font-bold'
                                                            : 'text-white/70'
                                                    }`}><AppIcon data-receipt={note.status} name={note.status === 'sent' ? 'check' : 'done_all'}/></span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Reactions - Slightly offset */}
                                <div className={`flex items-center flex-wrap gap-1 mt-1 px-1 relative ${isMe ? 'mr-1' : 'ml-1'}`}>
                                    <ReactionChips reactions={note.reactions as any} userId={user?.id} onReact={emoji => void handleReaction(note.id, emoji)}/>

                                    {/* Add Reaction Button */}
                                    {!isMe && (
                                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                aria-label="Add reaction"
                                                aria-expanded={emojiPickerNoteId === note.id}
                                                onClick={() => setEmojiPickerNoteId(emojiPickerNoteId === note.id ? null : note.id)}
                                                className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-pink-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-all outline-none bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-700/50 ml-0.5"
                                            >
                                                <span className="app-icon-glyph text-[14px]"><AppIcon name={"add"}/></span>
                                            </button>

                                            <AnimatePresence>
                                                {emojiPickerNoteId === note.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.8, y: 5 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.8, y: 5 }}
                                                        transition={motionTransition(springs.selection, reduced)}
                                                        className={`absolute bottom-full mb-1.5 ${isMe ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'} p-1.5 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md rounded-[20px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] border border-gray-200 dark:border-gray-700/50 z-50 flex items-center gap-1 w-max`}
                                                    >
                                                        {reactionEmojis.slice(0, 6).map((emoji) => (
                                                            <button
                                                                key={emoji}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (navigator.vibrate) navigator.vibrate(50);
                                                                    handleReaction(note.id, emoji);
                                                                    setEmojiPickerNoteId(null);
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center text-[1.4rem] hover:bg-gray-100 dark:hover:bg-white/10 rounded-full hover:scale-125 transition-all duration-200"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })
                )}
                <div ref={notesEndRef} />
            </div>

            {/* Reply bar + Input Area - Fixed at bottom */}
            {/* Hidden file input for browser image picking */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelected}
            />

            <div className="reference-chat-composer relative z-30 mx-auto flex w-full shrink-0 flex-col border-t border-black/5 bg-white p-3 dark:border-white/5 dark:bg-background-dark">
            {notes.some(note=>note.localStatus==='failed')&&<div role="status" className="mb-2 flex items-center justify-between rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-600"><span>Some messages have not been sent.</span><button onClick={()=>{for(const note of notes.filter(n=>n.localStatus==='failed'))void retryNote(note.id).catch(()=>{});}} className="min-h-11 px-3 font-semibold">Retry messages</button></div>}
            {/* Reply bar */}
            <AnimatePresence>
              {replyNote && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-dark rounded-t-2xl border border-b-0 border-gray-100 dark:border-gray-800">
                    <div className="flex-1 min-w-0 border-l-[3px] border-pink-500 pl-2.5">
                      <p className="text-[11px] font-bold text-pink-500 truncate">
                        {replyNote.sender_id === user?.id ? 'You' : (partnerProfile?.full_name?.split(' ')[0] || 'Partner')}
                      </p>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                        {replyNote.type === 'audio' ? '🎙 Voice message' : replyNote.type === 'image' ? '📷 Photo' : replyNote.type === 'gif' ? 'GIF' : replyNote.content}
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyToNoteId(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                      <span className="app-icon-glyph text-[18px]"><AppIcon name={"close"}/></span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`p-1.5 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border border-gray-100 dark:border-white/5 shadow-2xl shadow-black/20 transition-all ${replyNote ? 'rounded-b-[32px] rounded-t-none' : 'rounded-[32px]'}`}>
                <AnimatePresence mode="wait">
                {showRecorder ? (
                    <motion.div
                        key="recorder"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md md:max-w-full mx-auto"
                    >
                        <AudioRecorder
                            onSend={handleAudioSend}
                            onCancel={() => setShowRecorder(false)}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="input"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-end gap-2 max-w-md md:max-w-full mx-auto w-full"
                    >
                        {/* Left Side Action Buttons (Camera & GIF) */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handlePickImage}
                                className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-dark text-gray-500 hover:text-pink-500 hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-pink-500/20 active:scale-95 shadow-sm dark:shadow-none"
                                title="Photos"
                            >
                                <span className="app-icon-glyph text-[22px]"><AppIcon name={"add_a_photo"}/></span>
                            </button>

                            <button
                                onClick={() => setShowGifPicker(true)}
                                className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-dark text-gray-500 hover:text-purple-500 hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-purple-500/20 active:scale-95 shadow-sm dark:shadow-none"
                                title="GIFs"
                            >
                                <span className="app-icon-glyph text-[23px]"><AppIcon name={"gif_box"}/></span>
                            </button>
                        </div>

                        {/* Center Pill Container (Text + AI) */}
                        <div className="flex-1 min-w-0 bg-gray-100 dark:bg-white/5 rounded-[28px] flex items-center p-1 gap-2 border border-transparent focus-within:border-gray-200 dark:focus-within:border-white/10 transition-colors">
                            <button
                                onClick={() => setShowAISheet(true)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-violet-500 hover:bg-white dark:hover:bg-white/10 transition-all shrink-0 ml-1"
                                title="AI Love Note"
                            >
                                <span className="app-icon-glyph text-[20px]"><AppIcon name={"auto_awesome"}/></span>
                            </button>

                            <textarea
                                ref={textareaRef}
                                aria-label="Message"
                                maxLength={8000}
                                value={noteContent}
                                onChange={(e) => {
                                    setNoteContent(e.target.value);
                                    autoResizeTextarea();
                                }}
                                placeholder="Message..."
                                className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[36px] py-2 px-2 text-[15px] outline-none placeholder:text-gray-400 leading-[20px]"
                                rows={1}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        handleSendText();
                                    }
                                }}
                            />
                        </div>

                        {/* Right Side Action Button (Send/Mic) */}
                        <div className="shrink-0">
                            {noteContent.trim() ? (
                                <button
                                    onClick={handleSendText}
                                    aria-label="Send message"
                                    disabled={isSubmitting}
                                    className="on-brand w-[44px] h-[44px] flex items-center justify-center bg-primary text-white rounded-full hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
                                >
                                    <span className="app-icon-glyph text-[22px] ml-0.5"><AppIcon name={"arrow_upward"}/></span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowRecorder(true)}
                                    aria-label="Record voice message"
                                    className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-dark text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-primary/20 active:scale-95 shadow-sm dark:shadow-none"
                                >
                                    <span className="app-icon-glyph text-[22px]"><AppIcon name={"mic"}/></span>
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
            </div>

            <Toast
                message={toast.message}
                subMessage={toast.subMessage}
                isVisible={toast.isVisible}
                onClose={closeToast}
                type={toast.type}
            />

            {/* Confirmation Dialog (replaces native confirm()) */}
            <AnimatePresence>
                {confirmDialog && (
                    <MotionPortal><motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6"
                        onClick={() => setConfirmDialog(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold mb-2 dark:text-white">{confirmDialog.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">{confirmDialog.message}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        // For delete: "cancel" means delete for me only
                                        if (confirmDialog.cancelLabel === 'For Me Only') {
                                            const noteId = contextMenu?.noteId;
                                            if (noteId) deleteNote(noteId, false).catch(() => showToast('Error', 'Failed to delete', 'error'));
                                        }
                                        setConfirmDialog(null);
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium"
                                >
                                    {confirmDialog.cancelLabel || 'Cancel'}
                                </button>
                                <button
                                    onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                                    className="on-brand flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium"
                                >
                                    {confirmDialog.confirmLabel || 'Confirm'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div></MotionPortal>
                )}
            </AnimatePresence>

            {/* Image Preview Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <MotionPortal><motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative max-w-full max-h-[90vh] flex flex-col items-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {selectedImage.includes('giphy.com') ? (
                                <img
                                    src={selectedImage}
                                    alt="Full preview"
                                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
                                />
                            ) : (
                                <SecureImage
                                    src={selectedImage}
                                    partnerPubKey={partnerPubKey}
                                    alt="Full preview"
                                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
                                />
                            )}

                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                                >
                                    <span className="app-icon-glyph"><AppIcon name={"close"}/></span>
                                </button>
                                <button
                                    onClick={() => handleDownloadImage(selectedImage)}
                                    className="on-brand px-8 py-3 bg-primary hover:brightness-110 active:scale-95 text-white rounded-full font-bold shadow-lg shadow-primary/30 flex items-center gap-2 transition-all"
                                >
                                    <span className="app-icon-glyph"><AppIcon name={"download"}/></span>
                                    <span>Download</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div></MotionPortal>
                )}
            </AnimatePresence>

            {/* AI Love Note Bottom Sheet */}
            <AnimatePresence>
                {showAISheet && (
                    <MotionPortal><motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center"
                        onClick={() => !aiGenerating && setShowAISheet(false)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={motionTransition(springs.sheet, reduced)}
                            className="w-full max-w-md bg-white dark:bg-surface-dark rounded-t-3xl p-6 pb-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Handle bar */}
                            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-5" />

                            <div className="flex items-center gap-2 mb-5">
                                <span className="app-icon-glyph text-violet-500"><AppIcon name={"auto_awesome"}/></span>
                                <h3 className="text-lg font-bold">AI Love Note</h3>
                            </div>

                            {/* Mood chips */}
                            <p className="text-sm opacity-50 mb-3">Pick a mood</p>
                            <div className="grid grid-cols-3 gap-2 mb-5">
                                {AI_MOODS.map((m) => (
                                    <button
                                        key={m.key}
                                        onClick={() => setAIMood(m.key)}
                                        className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                                            aiMood === m.key
                                                ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                                                : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        <AppIcon name={m.emoji}/> {m.label}
                                    </button>
                                ))}
                            </div>

                            {/* Optional custom prompt */}
                            <p className="text-sm opacity-50 mb-2">Add context <span className="text-xs">(optional)</span></p>
                            <input
                                type="text"
                                value={aiCustomPrompt}
                                onChange={(e) => setAICustomPrompt(e.target.value)}
                                placeholder='e.g. "about our trip last weekend"'
                                className="w-full px-4 py-3 rounded-xl text-sm bg-gray-100 dark:bg-white/5 border border-transparent focus:border-violet-500 outline-none transition-colors mb-5"
                            />

                            {/* Generate button */}
                            <button
                                onClick={handleAIGenerate}
                                disabled={!aiMood || aiGenerating}
                                className={`w-full py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.98] ${
                                    !aiMood || aiGenerating
                                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 hover:brightness-110'
                                }`}
                            >
                                {aiGenerating ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <motion.span animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                            className="app-icon-glyph text-lg"><AppIcon name={"progress_activity"}/></motion.span>
                                        Generating...
                                    </span>
                                ) : (
                                    '✨ Generate Message'
                                )}
                            </button>
                        </motion.div>
                    </motion.div></MotionPortal>
                )}
            </AnimatePresence>
            {/* GIF Picker Sheet */}
            <AnimatePresence>
                {showGifPicker && (
                    <MotionPortal><motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center"
                        onClick={() => setShowGifPicker(false)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={motionTransition(springs.sheet, reduced)}
                            className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-t-3xl p-4 h-[70vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />

                            <div className="relative mb-4">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 app-icon-glyph text-gray-400"><AppIcon name={"search"}/></span>
                                <input
                                    type="text"
                                    value={gifSearch}
                                    onChange={(e) => handleGifSearchChange(e.target.value)}
                                    placeholder="Search GIPHY..."
                                    className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-white/5 rounded-xl outline-none focus:ring-2 ring-primary/50 transition-all"
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar columns-2 gap-2 pb-safe px-1">
                                {gifLoading && gifResults.length === 0 ? (
                                    <div className="col-span-2 flex justify-center py-10 w-full">
                                        <span className="app-icon-glyph animate-spin text-gray-400"><AppIcon name={"progress_activity"}/></span>
                                    </div>
                                ) : (
                                    (gifResults.length > 0 ? gifResults : []).map((gif: any) => (
                                        <button
                                            key={gif.id}
                                            // Use fixed_width for best balance of quality/speed in chat
                                            onClick={() => handleSendGif(gif.images.fixed_width?.url || gif.images.fixed_height?.url)}
                                            className="w-full mb-2 rounded-lg overflow-hidden group break-inside-avoid bg-gray-100 dark:bg-white/5"
                                        >
                                            <img
                                                src={gif.images.fixed_width.url}
                                                alt={gif.title}
                                                className="w-full h-auto object-cover transition-transform group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        </button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div></MotionPortal>
                )}
            </AnimatePresence>
            {/* Security Verification Modal */}
            <SecurityVerification
                isOpen={showSecurity}
                onClose={() => setShowSecurity(false)}
                partnerPubKey={partnerPubKey}
            />

            {/* Message Context Menu */}
            <MessageContextMenu
              isOpen={!!contextMenu}
              onClose={() => setContextMenu(null)}
              actions={buildMenuActions()}
              anchor={contextMenu?.anchor || 'left'}
              x={contextMenu?.x || 0}
              y={contextMenu?.y || 0}
            />

            {/* Message Info Modal */}
            <AnimatePresence>
              {messageInfoNote && (
                <MotionPortal><motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center"
                  onClick={() => setMessageInfoNote(null)}
                >
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={motionTransition(springs.sheet, reduced)}
                    className="w-full max-w-md bg-white dark:bg-surface-dark rounded-t-3xl p-6 pb-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-5" />
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <span className="app-icon-glyph text-pink-500"><AppIcon name={"info"}/></span>
                      Message Info
                    </h3>

                    <div className="space-y-4">
                      {/* Message preview */}
                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                        <p className="text-sm truncate max-w-full">
                          {messageInfoNote.type === 'audio' ? '🎙 Voice message' : messageInfoNote.type === 'image' ? '📷 Photo' : messageInfoNote.type === 'gif' ? 'GIF' : messageInfoNote.content}
                        </p>
                      </div>

                      {/* Status details */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className="app-icon-glyph text-[18px]"><AppIcon name={"schedule"}/></span>
                            Sent
                          </span>
                          <span className="font-medium">
                            {new Date(messageInfoNote.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' '}
                            {new Date(messageInfoNote.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className={`app-icon-glyph text-[18px] ${messageInfoNote.status === 'read' ? 'text-[#53bdeb]' : ''}`}><AppIcon name={"done_all"}/></span>
                            Status
                          </span>
                          <span className={`font-medium capitalize ${messageInfoNote.status === 'read' ? 'text-[#53bdeb]' : ''}`}>
                            {messageInfoNote.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className="app-icon-glyph text-[18px]"><AppIcon name={"person"}/></span>
                            From
                          </span>
                          <span className="font-medium">
                            {messageInfoNote.sender_id === user?.id ? 'You' : (partnerProfile?.full_name || 'Partner')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className="app-icon-glyph text-[18px]"><AppIcon name={"category"}/></span>
                            Type
                          </span>
                          <span className="font-medium capitalize">{messageInfoNote.type}</span>
                        </div>

                        {messageInfoNote.is_forwarded && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <span className="app-icon-glyph text-[18px]"><AppIcon name={"forward"}/></span>
                              Forwarded
                            </span>
                            <span className="font-medium text-amber-500">Yes</span>
                          </div>
                        )}

                        {(messageInfoNote.starred_by?.length ?? 0) > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <span className="app-icon-glyph text-[18px] text-amber-400"><AppIcon name={"star"}/></span>
                              Starred by
                            </span>
                            <span className="font-medium">{messageInfoNote.starred_by?.includes(user?.id ?? '') ? 'You' : ''}{messageInfoNote.starred_by?.includes(user?.id ?? '') && (messageInfoNote.starred_by?.length ?? 0) > 1 ? ' & Partner' : ''}{!messageInfoNote.starred_by?.includes(user?.id ?? '') ? 'Partner' : ''}</span>
                          </div>
                        )}

                        {/* Reactions */}
                        {Array.isArray(messageInfoNote.reactions) && messageInfoNote.reactions.length > 0 && (
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                            <p className="text-xs text-gray-400 mb-2">Reactions</p>
                            <div className="flex flex-wrap gap-2">
                              {messageInfoNote.reactions.map((r, i) => (
                                <span key={i} className="text-lg" title={r.user_id === user?.id ? 'You' : 'Partner'}>
                                  {r.emoji}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setMessageInfoNote(null)}
                      className="on-brand w-full mt-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30 hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      Close
                    </button>
                  </motion.div>
                </motion.div></MotionPortal>
              )}
            </AnimatePresence>
        </div>
    );
};

export default LoveLock;
