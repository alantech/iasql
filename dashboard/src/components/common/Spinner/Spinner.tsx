import styles from './Spinner.module.css';

export default function Spinner() {
  return <div className={`${styles.loader} text-primary`} />;
}

export function AWSSpinner() {
  return <img src="https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg" className={`${styles.aws} rotate`} />;
}