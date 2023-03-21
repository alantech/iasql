import styles from './Spinner.module.css';

export default function Spinner() {
  return <div className={`${styles.loader} text-primary`} />;
}

export function AWSSpinner() {
  return <img src='/aws.svg' className={`${styles.aws} rotate`} />;
}
