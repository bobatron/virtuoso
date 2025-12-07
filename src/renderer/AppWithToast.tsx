import React from 'react';
import { Toaster } from 'react-hot-toast';
import App from './App';

const AppWithToast: React.FC = () => {
    return (
        <>
            <App />
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#333',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                    },
                    success: {
                        iconTheme: {
                            primary: '#4caf50',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#f44336',
                            secondary: '#fff',
                        },
                    },
                }}
            />
        </>
    );
};

export default AppWithToast;
