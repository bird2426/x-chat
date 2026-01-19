import styles from './Toast.module.css';

interface ToastProps {
    message: string;
    isVisible: boolean;
}

export function Toast({ message, isVisible }: ToastProps) {
    if (!isVisible) return null;

    return (
        <div className={styles.toast}>
            ✅ {message}
        </div>
    );
}
