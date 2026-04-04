import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated'
}

const variantStyles = {
  default: 'bg-white rounded-2xl border border-gray-100',
  bordered: 'bg-white rounded-2xl border border-gray-200',
  elevated: 'bg-white rounded-2xl shadow-md shadow-gray-100',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(variantStyles[variant], className)}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

// Sub-components for structured card content
export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 pt-5 pb-3', className)} {...props} />
)

export const CardBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 pb-5', className)} {...props} />
)

export const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 py-3 border-t border-gray-100', className)} {...props} />
)
