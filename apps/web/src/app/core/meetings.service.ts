import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface StoredMessage {
  id: string;
  senderIdentity: string;
  senderName: string;
  body: string;
  at: string;
}

/**
 * Persistence for a call. Every endpoint is authorised by the LiveKit room
 * token, which proves membership of that specific room — guests included.
 */
@Injectable({ providedIn: 'root' })
export class MeetingsService {
  private readonly http = inject(HttpClient);

  private headers(roomToken: string): HttpHeaders {
    return new HttpHeaders({ 'X-Room-Token': roomToken });
  }

  history(roomToken: string): Promise<StoredMessage[]> {
    return firstValueFrom(
      this.http.get<StoredMessage[]>('/api/meetings/messages', {
        headers: this.headers(roomToken),
      }),
    );
  }

  save(roomToken: string, id: string, body: string): Promise<StoredMessage> {
    return firstValueFrom(
      this.http.post<StoredMessage>(
        '/api/meetings/messages',
        { id, body },
        { headers: this.headers(roomToken) },
      ),
    );
  }

  /** `startedAt` is when the meeting began, not this participant's session. */
  startSession(roomToken: string): Promise<{ id: string; startedAt: string }> {
    return firstValueFrom(
      this.http.post<{ id: string; startedAt: string }>(
        '/api/meetings/sessions',
        {},
        { headers: this.headers(roomToken) },
      ),
    );
  }

  endSession(roomToken: string, sessionId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `/api/meetings/sessions/${sessionId}/leave`,
        {},
        { headers: this.headers(roomToken) },
      ),
    );
  }
}
