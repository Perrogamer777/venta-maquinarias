'use client';
import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, Timestamp, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import {
    MessageSquarePlus,
    ArrowBigUp,
    Clock,
    Filter,
    Search,
    Plus,
    X,
    MessageSquare,
    CheckCircle2,
    Loader2,
    AlertCircle,
    ImagePlus,
    Trash2,
    Send,
    Edit2,
    Check
} from 'lucide-react';

interface FeedbackPost {
    id: string;
    title: string;
    description: string;
    category: 'sugerencia' | 'mejora' | 'bug' | 'otro';
    votes: number;
    votedBy: string[];
    createdAt: any;
    authorName: string;
    status: 'pendiente' | 'en_revision' | 'completado';
    imageUrl?: string;
}

interface Comment {
    id: string;
    authorName: string;
    content: string;
    createdAt: any;
}

const CATEGORIES = {
    sugerencia: { label: 'Sugerencia', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    mejora: { label: 'Mejora', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    bug: { label: 'Bug', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    otro: { label: 'Otro', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
};

const STATUSES = {
    pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    en_revision: { label: 'En Revisión', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    completado: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
};

export default function FeedbackPage() {
    const [posts, setPosts] = useState<FeedbackPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [sortBy, setSortBy] = useState<'votes' | 'date'>('votes');
    const [searchTerm, setSearchTerm] = useState('');
    const [userId, setUserId] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'sugerencia' as FeedbackPost['category'],
        authorName: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Image upload state
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Comments state
    const [selectedPost, setSelectedPost] = useState<FeedbackPost | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [commentAuthor, setCommentAuthor] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    useEffect(() => {
        // Initialize simple user ID for voting persistence
        let storedId = localStorage.getItem('feedback_visitor_id');
        if (!storedId) {
            storedId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('feedback_visitor_id', storedId);
        }
        setUserId(storedId);

        // Load saved author name
        const savedName = localStorage.getItem('feedback_user_name');
        if (savedName) {
            setCommentAuthor(savedName);
        }

        // Real-time listener
        const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FeedbackPost));
            setPosts(fetchedPosts);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load comments when selectedPost changes
    useEffect(() => {
        if (!selectedPost) {
            setComments([]);
            return;
        }

        setLoadingComments(true);
        const commentsRef = collection(db, 'feedback', selectedPost.id, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Comment));
            setComments(fetchedComments);
            setLoadingComments(false);
        });

        return () => unsubscribe();
    }, [selectedPost?.id]);

    const handleVote = async (post: FeedbackPost, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userId) {
            console.error("No user ID found");
            return;
        }

        const hasVoted = post.votedBy.includes(userId);
        const postRef = doc(db, 'feedback', post.id);

        try {
            if (hasVoted) {
                await updateDoc(postRef, {
                    votes: increment(-1),
                    votedBy: arrayRemove(userId)
                });
            } else {
                await updateDoc(postRef, {
                    votes: increment(1),
                    votedBy: arrayUnion(userId)
                });
            }
        } catch (error) {
            console.error('Error voting:', error);
            alert('Error al guardar el voto.');
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('La imagen es muy grande. Máximo 5MB.');
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.description || !formData.authorName) return;

        setSubmitting(true);
        try {
            let imageUrl = '';
            if (imageFile && storage) {
                setUploadingImage(true);
                const fileName = `feedback/${Date.now()}_${imageFile.name}`;
                const storageRef = ref(storage, fileName);
                await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(storageRef);
                setUploadingImage(false);
            }

            await addDoc(collection(db, 'feedback'), {
                ...formData,
                votes: 0,
                votedBy: [],
                status: 'pendiente',
                createdAt: Timestamp.now(),
                ...(imageUrl && { imageUrl })
            });
            setShowModal(false);
            setFormData({ title: '', description: '', category: 'sugerencia', authorName: '' });
            removeImage();
        } catch (error) {
            console.error('Error creating post:', error);
        } finally {
            setSubmitting(false);
            setUploadingImage(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPost || !newComment.trim() || !commentAuthor.trim()) return;

        setSubmittingComment(true);
        try {
            // Save author name for future use
            localStorage.setItem('feedback_user_name', commentAuthor);

            const commentsRef = collection(db, 'feedback', selectedPost.id, 'comments');
            await addDoc(commentsRef, {
                authorName: commentAuthor,
                content: newComment.trim(),
                createdAt: Timestamp.now()
            });
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error al agregar comentario.');
        } finally {
            setSubmittingComment(false);
        }
    };

    const openPostDetail = (post: FeedbackPost) => {
        setSelectedPost(post);
    };

    const closePostDetail = () => {
        setSelectedPost(null);
        setNewComment('');
    };

    const filteredPosts = posts
        .filter(post =>
            post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'votes') return b.votes - a.votes;
            return b.createdAt?.seconds - a.createdAt?.seconds;
        });

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        return new Date(timestamp.seconds * 1000).toLocaleDateString('es-CL', {
            day: 'numeric', month: 'short'
        });
    };

    const formatDateTime = (timestamp: any) => {
        if (!timestamp) return '';
        return new Date(timestamp.seconds * 1000).toLocaleString('es-CL', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto animate-fade-in">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <MessageSquarePlus className="text-purple-600" size={24} />
                            Sugerencias y Mejoras
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">
                            Ayúdanos a mejorar votando por las próximas características.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium text-sm shadow-md shadow-purple-500/20"
                    >
                        <Plus size={18} />
                        Nueva Idea
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar sugerencias..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <button
                            onClick={() => setSortBy('votes')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${sortBy === 'votes'
                                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <ArrowBigUp size={18} />
                            Más Votados
                        </button>
                        <button
                            onClick={() => setSortBy('date')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${sortBy === 'date'
                                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <Clock size={16} />
                            Recientes
                        </button>
                    </div>
                </div>

                {/* Posts List */}
                <div className="space-y-3">
                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
                        ))
                    ) : filteredPosts.length === 0 ? (
                        <div className="text-center py-20 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-3xl border border-gray-100 dark:border-gray-800">
                            <div className="w-20 h-20 bg-purple-50 dark:bg-purple-900/20 text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Se el primero en opinar</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                Esta comunidad crece con tus ideas. Comparte, vota y mejora la experiencia para todos.
                            </p>
                        </div>
                    ) : (
                        filteredPosts.map(post => {
                            const hasVoted = post.votedBy.includes(userId);
                            return (
                                <div
                                    key={post.id}
                                    className="group flex bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-purple-500/5 hover:border-purple-500/30 transition-all duration-300 cursor-pointer"
                                    onClick={() => openPostDetail(post)}
                                >
                                    {/* Vote Sidebar */}
                                    <div
                                        onClick={(e) => handleVote(post, e)}
                                        className={`w-16 sm:w-20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors border-r border-gray-100 dark:border-gray-800 ${hasVoted
                                            ? 'bg-purple-50/50 dark:bg-purple-900/20'
                                            : 'bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-xl transition-all ${hasVoted ? 'bg-purple-100 dark:bg-purple-900/50' : 'group-hover:bg-gray-200 dark:group-hover:bg-gray-700'}`}>
                                            <ArrowBigUp
                                                size={32}
                                                className={`transition-all ${hasVoted
                                                    ? 'text-purple-600 fill-purple-600'
                                                    : 'text-gray-400 group-hover:text-purple-500'
                                                    }`}
                                            />
                                        </div>
                                        <span className={`font-bold text-lg ${hasVoted ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {post.votes}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${CATEGORIES[post.category].color}`}>
                                                        {CATEGORIES[post.category].label}
                                                    </span>
                                                    <span className="text-xs text-gray-400">•</span>
                                                    <span className="text-xs text-gray-400 font-medium">Publicado el {formatDate(post.createdAt)}</span>
                                                </div>
                                                <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight group-hover:text-purple-600 transition-colors">
                                                    {post.title}
                                                </h3>
                                            </div>

                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap self-start ${STATUSES[post.status].color}`}>
                                                {post.status === 'completado' ? <CheckCircle2 size={14} /> :
                                                    post.status === 'en_revision' ? <Clock size={14} /> :
                                                        <AlertCircle size={14} />}
                                                {STATUSES[post.status].label}
                                            </div>
                                        </div>

                                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-3 line-clamp-2">
                                            {post.description}
                                        </p>

                                        {post.imageUrl && (
                                            <div className="mb-4">
                                                <img
                                                    src={post.imageUrl}
                                                    alt="Adjunto"
                                                    className="max-h-32 rounded-xl border border-gray-200 dark:border-gray-700"
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-3 mt-auto">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                                                    {post.authorName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {post.authorName}
                                                </span>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openPostDetail(post);
                                                }}
                                                className="flex items-center gap-2 text-gray-400 hover:text-purple-600 transition-colors text-sm font-medium"
                                            >
                                                <MessageSquare size={16} />
                                                <span>Comentar</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div
                        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Sugerencia</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Título corto</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="Ej: Modo oscuro automático"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Categoría</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none appearance-none"
                                    >
                                        <option value="sugerencia">Sugerencia</option>
                                        <option value="mejora">Mejora</option>
                                        <option value="bug">Bug</option>
                                        <option value="otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tu Nombre</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.authorName}
                                        onChange={e => setFormData({ ...formData, authorName: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="Ej: Juan Pérez"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Descripción detallada</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                    placeholder="Explica tu idea con detalle..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Imagen (opcional)
                                </label>

                                {!imagePreview ? (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all"
                                    >
                                        <ImagePlus size={32} className="mx-auto text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-500">Haz clic para subir una imagen</p>
                                        <p className="text-xs text-gray-400 mt-1">PNG, JPG hasta 5MB</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full max-h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeImage}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="hidden"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            {uploadingImage ? 'Subiendo imagen...' : 'Publicando...'}
                                        </>
                                    ) : 'Publicar Idea'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Post Detail Modal with Comments */}
            {selectedPost && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={closePostDetail}>
                    <div
                        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${CATEGORIES[selectedPost.category].color}`}>
                                        {CATEGORIES[selectedPost.category].label}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUSES[selectedPost.status].color}`}>
                                        {STATUSES[selectedPost.status].label}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPost.title}</h2>
                                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                                            {selectedPost.authorName.charAt(0).toUpperCase()}
                                        </div>
                                        <span>{selectedPost.authorName}</span>
                                    </div>
                                    <span>•</span>
                                    <span>{formatDate(selectedPost.createdAt)}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <ArrowBigUp size={16} className="text-purple-500" />
                                        {selectedPost.votes} votos
                                    </span>
                                </div>
                            </div>
                            <button onClick={closePostDetail} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap mb-6">
                                {selectedPost.description}
                            </p>

                            {selectedPost.imageUrl && (
                                <div className="mb-6">
                                    <img
                                        src={selectedPost.imageUrl}
                                        alt="Adjunto"
                                        className="max-w-full rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(selectedPost.imageUrl, '_blank')}
                                    />
                                </div>
                            )}

                            {/* Comments Section */}
                            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <MessageSquare size={20} className="text-purple-500" />
                                    Comentarios ({comments.length})
                                </h3>

                                {loadingComments ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="animate-spin text-purple-500" size={24} />
                                    </div>
                                ) : comments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                                        <p>Sé el primero en comentar</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 mb-6">
                                        {comments.map(comment => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {comment.authorName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-tl-md p-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-sm text-gray-900 dark:text-white">{comment.authorName}</span>
                                                        <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>
                                                    </div>
                                                    <p className="text-gray-700 dark:text-gray-300 text-sm">{comment.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Comment Input */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                            <form onSubmit={handleAddComment} className="flex flex-col gap-3">
                                {!commentAuthor && (
                                    <input
                                        type="text"
                                        placeholder="Tu nombre..."
                                        value={commentAuthor}
                                        onChange={(e) => setCommentAuthor(e.target.value)}
                                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    />
                                )}
                                <div className="flex gap-2">
                                    {commentAuthor && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                                            {editingName ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={tempName}
                                                        onChange={(e) => setTempName(e.target.value)}
                                                        className="flex-1 text-sm outline-none bg-transparent min-w-[120px]"
                                                        autoFocus
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter' && tempName.trim()) {
                                                                setCommentAuthor(tempName.trim());
                                                                localStorage.setItem('feedback_user_name', tempName.trim());
                                                                setEditingName(false);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (tempName.trim()) {
                                                                setCommentAuthor(tempName.trim());
                                                                localStorage.setItem('feedback_user_name', tempName.trim());
                                                                setEditingName(false);
                                                            }
                                                        }}
                                                        className="p-1 text-green-600 hover:text-green-700 transition-colors"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingName(false);
                                                            setTempName(commentAuthor);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        {commentAuthor}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingName(true);
                                                            setTempName(commentAuthor);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                                        title="Editar nombre"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Escribe un comentario..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={submittingComment || !newComment.trim()}
                                        className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
                                    >
                                        {submittingComment ? (
                                            <Loader2 className="animate-spin" size={18} />
                                        ) : (
                                            <Send size={18} />
                                        )}
                                    </button>
                                </div>
                                {commentAuthor && (
                                    <p className="text-xs text-gray-400">
                                        Comentando como <span className="font-medium text-gray-600 dark:text-gray-300">{commentAuthor}</span>
                                    </p>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
