'use client';

import { cva, type VariantProps } from 'class-variance-authority';

const skeleton = cva(
    'animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-xl',
    {
        variants: {
            variant: {
                card: 'w-full h-72',
                stat: 'w-full h-24',
                text: 'h-4 w-full',
                avatar: 'w-10 h-10 rounded-full',
                button: 'h-10 w-24',
            },
        },
        defaultVariants: {
            variant: 'card',
        },
    }
);

export interface SkeletonProps extends VariantProps<typeof skeleton> {
    className?: string;
}

export function Skeleton({ variant, className }: SkeletonProps) {
    return <div className={skeleton({ variant, className })} />;
}

// Skeleton Card for Promociones
export function SkeletonPromoCard() {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
            {/* Image skeleton */}
            <div className="h-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse" />

            {/* Content skeleton */}
            <div className="p-4 space-y-3">
                {/* Title */}
                <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded-lg w-3/4" />

                {/* Description */}
                <div className="space-y-2">
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-full" />
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-5/6" />
                </div>

                {/* Stats */}
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-1/3" />

                {/* Button */}
                <div className="h-10 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded-xl w-full" />
            </div>
        </div>
    );
}

// Skeleton for Stats Cards
export function SkeletonStatCard() {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-24" />
                    <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-20" />
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded-xl" />
            </div>
        </div>
    );
}

// Skeleton for List Items
export function SkeletonListItem() {
    return (
        <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
            {/* Avatar */}
            <div className="w-10 h-10 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded-full flex-shrink-0" />

            {/* Content */}
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-1/2" />
                <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-3/4" />
            </div>

            {/* Action */}
            <div className="w-20 h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded-lg" />
        </div>
    );
}

// Skeleton for Table Rows
export function SkeletonTableRow() {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded flex-1" />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-32" />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded w-24" />
            <div className="h-8 w-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse rounded-lg" />
        </div>
    );
}
