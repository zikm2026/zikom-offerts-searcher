import { EmailMessage } from '../../../types/email';
import { htmlToText } from './htmlCleaner';

export interface PrepareOptions {
  maxLength?: number;
  forParsingLaptops?: boolean;
}

export function prepareEmailContent(
  email: EmailMessage,
  maxLength: number = 2000,
  forParsingLaptops: boolean = false
): string {
  const parts: string[] = [];

  parts.push(`From: ${email.from}`);
  parts.push(`Subject: ${email.subject}`);
  parts.push(`Date: ${email.date.toISOString()}`);

  if (forParsingLaptops) {
    const textContent = (email.text || '').trim();
    const htmlContent = email.html ? htmlToText(email.html, maxLength) : '';
    const useText = textContent.length >= htmlContent.length || !email.html;
    const body = useText ? textContent.substring(0, maxLength) : htmlContent;
    parts.push(body ? `Treść:\n${body}` : '(brak treści)');
  } else {
    const half = Math.floor(maxLength / 2);
    if (email.text && email.html) {
      parts.push(`Text Content: ${email.text.substring(0, half)}`);
      parts.push(`HTML Content (cleaned): ${htmlToText(email.html, half)}`);
    } else if (email.text) {
      parts.push(`Text Content: ${email.text.substring(0, maxLength)}`);
    } else if (email.html) {
      parts.push(`HTML Content (cleaned): ${htmlToText(email.html, maxLength)}`);
    }
  }

  return parts.join('\n\n');
}
