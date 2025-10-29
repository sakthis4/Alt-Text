import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { ToastMessage, ToastType, User, AuthContextType } from '../types';
import { ToastContainer } from '../components/Toast';

// Toast Context
interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // FIX: Replaced JSX with React.createElement to be compatible with a .ts file extension.
  return React.createElement(
    ToastContext.Provider,
    { value: { addToast } },
    children,
    React.createElement(ToastContainer, { toasts, onDismiss: removeToast })
  );
};


// --- Auth Context ---
const USERS_STORAGE_KEY = 'ai_tools_users';
const SESSION_STORAGE_KEY = 'ai_tools_session';

const userService = {
    init: () => {
        if (!localStorage.getItem(USERS_STORAGE_KEY)) {
            const defaultUsers: User[] = [
                { id: '1', username: 'admin', password: 'admin123', role: 'admin', tokens: 10000 },
                { id: '2', username: 'user', password: 'user123', role: 'user', tokens: 500 },
            ];
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
        }
    },
    getUsers: (): User[] => {
        const users = localStorage.getItem(USERS_STORAGE_KEY);
        return users ? JSON.parse(users) : [];
    },
    saveUsers: (users: User[]) => {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    },
};

userService.init();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = sessionStorage.getItem(SESSION_STORAGE_KEY);
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const updateUserStateAndStorage = (updatedUser: User | null) => {
        setUser(updatedUser);
        if (updatedUser) {
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
            const allUsers = userService.getUsers();
            const userIndex = allUsers.findIndex(u => u.id === updatedUser.id);
            if (userIndex !== -1) {
                allUsers[userIndex] = { ...allUsers[userIndex], ...updatedUser };
                userService.saveUsers(allUsers);
            }
        } else {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    }

    const login = async (username: string, password: string): Promise<boolean> => {
        const users = userService.getUsers();
        const foundUser = users.find(u => u.username === username && u.password === password);
        if (foundUser) {
            const { password, ...userToStore } = foundUser;
            updateUserStateAndStorage(userToStore);
            return true;
        }
        return false;
    };

    const logout = () => {
        updateUserStateAndStorage(null);
    };

    const decrementTokens = (amount: number) => {
        if (user) {
            const newTokens = Math.max(0, user.tokens - amount);
            updateUserStateAndStorage({ ...user, tokens: newTokens });
        }
    };
    
    const getUsers = () => userService.getUsers().map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
    });

    const addUser = (newUser: Omit<User, 'id'>) => {
        const users = userService.getUsers();
        if (users.some(u => u.username === newUser.username)) {
            return false; // Username already exists
        }
        const userWithId: User = { ...newUser, id: `${Date.now()}` };
        userService.saveUsers([...users, userWithId]);
        return true;
    };

    const deleteUser = (userId: string) => {
        if (user?.id === userId) return; // Cannot delete self
        const users = userService.getUsers();
        userService.saveUsers(users.filter(u => u.id !== userId));
    };
    
    const addTokens = (userId: string, amount: number) => {
        const users = userService.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].tokens += amount;
            userService.saveUsers(users);
            // If updating the current user, update session state as well
            if (user && user.id === userId) {
                 updateUserStateAndStorage(users[userIndex]);
            }
        }
    };

    const value = { user, login, logout, decrementTokens, getUsers, addUser, deleteUser, addTokens };

    // FIX: Replaced JSX with React.createElement to be compatible with a .ts file extension.
    return React.createElement(AuthContext.Provider, { value: value }, children);
}