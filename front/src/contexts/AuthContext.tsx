'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    User,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

// Tenant info structure
interface TenantInfo {
    id: string;
    name: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    userTenants: TenantInfo[];
    loadingTenants: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userTenants, setUserTenants] = useState<TenantInfo[]>([]);
    const [loadingTenants, setLoadingTenants] = useState(false);

    // Check if user is admin
    const isAdmin = user?.email === 'admin@admin.cl';

    // Load user's allowed tenants
    useEffect(() => {
        if (!user) {
            setUserTenants([]);
            return;
        }

        async function loadUserTenants() {
            setLoadingTenants(true);
            try {
                // Check if admin (flexible check - includes admin in email or specific admin email)
                const isAdminUser = user?.email === 'admin@admin.cl' || user?.email?.includes('admin');

                if (isAdminUser) {
                    // Admin: get all tenants from 'clients' collection (where tenant data lives)
                    console.log('📂 Admin: Querying all tenants from clients collection...');
                    const tenantsSnapshot = await getDocs(collection(db, 'clients'));

                    const tenants: TenantInfo[] = tenantsSnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            name: data.businessName || data.companyName || doc.id
                        };
                    });
                    console.log('[Auth] Tenants loaded:', tenants.length);
                    setUserTenants(tenants);
                } else {
                    // Regular user: check their profile for allowed tenants
                    const userDocRef = doc(db, 'users', user!.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const allowedTenantIds: string[] = userData.allowedTenants || [];

                        // Fetch tenant details for each allowed tenant
                        const tenantPromises = allowedTenantIds.map(async (tenantId) => {
                            // Tenants are in 'clients' collection
                            const tenantDoc = await getDoc(doc(db, 'clients', tenantId));
                            if (tenantDoc.exists()) {
                                const data = tenantDoc.data();
                                return {
                                    id: tenantId,
                                    name: data.businessName || data.companyName || tenantId
                                };
                            }
                            return null;
                        });

                        const tenants = (await Promise.all(tenantPromises)).filter(Boolean) as TenantInfo[];
                        setUserTenants(tenants);
                    } else {
                        // No user profile found - try fallback
                        console.warn('[Auth] No user profile found, trying fallback load...');

                        try {
                            // Fallback: load from 'clients'
                            const tenantsSnapshot = await getDocs(collection(db, 'clients'));
                            if (tenantsSnapshot.size > 0) {
                                const tenants: TenantInfo[] = tenantsSnapshot.docs.map(doc => {
                                    const data = doc.data();
                                    return {
                                        id: doc.id,
                                        name: data.businessName || data.companyName || doc.id
                                    };
                                });
                                console.log('[Auth] Fallback: Found tenants:', tenants.length);
                                setUserTenants(tenants);
                            } else {
                                setUserTenants([]);
                            }
                        } catch (fallbackError) {
                            console.error('[Auth] Fallback failed:', fallbackError);
                            setUserTenants([]);
                        }
                    }
                }
            } catch (error) {
                console.error('[Auth] Error loading user tenants:', error);
                setUserTenants([]);
            } finally {
                setLoadingTenants(false);
            }
        }

        loadUserTenants();
    }, [user]);

    // Listen for auth state changes
    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        if (!auth) {
            throw new Error('Firebase Auth no está configurado');
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: unknown) {
            const errorCode = (error as { code?: string })?.code;

            // Translate Firebase errors to Spanish
            switch (errorCode) {
                case 'auth/invalid-email':
                    throw new Error('El email no es válido');
                case 'auth/user-disabled':
                    throw new Error('Esta cuenta ha sido deshabilitada');
                case 'auth/user-not-found':
                    throw new Error('No existe una cuenta con este email');
                case 'auth/wrong-password':
                    throw new Error('Contraseña incorrecta');
                case 'auth/invalid-credential':
                    throw new Error('Credenciales inválidas. Verifica tu email y contraseña');
                case 'auth/too-many-requests':
                    throw new Error('Demasiados intentos fallidos. Intenta más tarde');
                default:
                    throw new Error('Error al iniciar sesión');
            }
        }
    };

    const logout = async () => {
        if (!auth) return;
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAdmin,
            userTenants,
            loadingTenants,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
