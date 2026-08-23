import { FC } from 'react';
import styles from './SecurityAlert.module.css';

export const SecurityAlert: FC<{ incidentType: string; message: string }> = ({ incidentType, message }) => (
  <div className={styles['security-alert']}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
    <div>
      <h4>Security Alert: {incidentType}</h4>
      <p>{message}</p>
    </div>
  </div>
);
