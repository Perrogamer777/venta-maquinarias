'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import React from 'react';

const button = cva(
    'inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
    {
        variants: {
            variant: {
                primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-lg shadow-emerald-600/20',
                secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-gray-500',
                ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-gray-500',
                danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-600/20',
                outline: 'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:ring-emerald-500',
            },
            size: {
                sm: 'px-3 py-1.5 text-sm gap-1.5',
                md: 'px-4 py-2.5 text-sm gap-2',
                lg: 'px-6 py-3 text-base gap-2.5',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant, size, isLoading, children, disabled, className, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={button({ variant, size, className })}
                disabled={isLoading || disabled}
                {...props}
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
