import React from 'react';
import { useAuth } from '../hooks/useToast';

const Icon: React.FC = () => (
  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"></path>
  </svg>
);

interface HeaderProps {
    setPage: (page: 'home' | 'tool' | 'admin') => void;
    currentPage: string;
}

export const Header: React.FC<HeaderProps> = ({ setPage, currentPage }) => {
  const { user, logout } = useAuth();

  const NavButton: React.FC<{ page: 'home' | 'tool' | 'admin', children: React.ReactNode }> = ({ page, children }) => (
    <button
      onClick={() => setPage(page)}
      className={`px-3 py-2 rounded-md text-sm font-medium ${currentPage === page ? 'bg-white/20 text-white' : 'text-indigo-100 hover:bg-white/10'}`}
    >
      {children}
    </button>
  );

  return (
    <header className="bg-primary shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
                 <div className="bg-white/20 p-2 rounded-lg">
                    <Icon/>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight hidden sm:block">
                  AI Tools Suite
                </h1>
            </div>

            {user && (
                <div className="flex items-center space-x-4">
                    <nav className="flex items-center space-x-2">
                        <NavButton page="home">Home</NavButton>
                        {user.role === 'admin' && <NavButton page="admin">Admin Panel</NavButton>}
                    </nav>
                    <div className="flex items-center space-x-3">
                         <div className="text-right hidden md:block">
                            <p className="text-sm font-medium text-white">{user.username}</p>
                            <p className="text-xs text-indigo-200">Tokens: {user.tokens.toLocaleString()}</p>
                        </div>
                        <button 
                            onClick={logout}
                            className="px-3 py-2 rounded-md text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};