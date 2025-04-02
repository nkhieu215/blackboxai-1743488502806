import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, timer, from, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, retry } from 'rxjs/operators';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export interface PermissionState {
  state: 'prompt' | 'granted' | 'denied' | 'blocked' | 'unavailable';
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private recognition: any;
  private transcriptSubject = new Subject<string>();
  private errorSubject = new Subject<string>();
  private isListeningSubject = new BehaviorSubject<boolean>(false);
  private permissionSubject = new BehaviorSubject<PermissionState>({ state: 'prompt' });
  private permissionTimeout: any;
  private restartTimeout: any;
  private deviceCheckInterval: any;
  private maxRestartAttempts = 3;
  private currentRestartAttempt = 0;
  private isDeviceAvailable = false;
  private lastDeviceCheck = 0;
  private readonly deviceCheckThrottle = 1000; // Minimum time between device checks
  
  transcript$ = this.transcriptSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  isListening$ = this.isListeningSubject.asObservable().pipe(
    debounceTime(300), // Debounce state changes to prevent flickering
    distinctUntilChanged() // Only emit when the state actually changes
  );
  permission$ = this.permissionSubject.asObservable().pipe(
    distinctUntilChanged((prev, curr) => 
      prev.state === curr.state && prev.errorMessage === curr.errorMessage
    )
  );

  constructor() {
    this.initSpeechRecognition();
    this.startDeviceCheck();
  }

  private async startDeviceCheck() {
    // Initial check
    await this.checkDeviceAvailability();
    
    // Set up periodic checks with error handling and retry
    this.deviceCheckInterval = setInterval(async () => {
      try {
        await this.checkDeviceAvailability();
      } catch (error) {
        console.error('Error in device check interval:', error);
      }
    }, 5000);
  }

  private async checkDeviceAvailability(): Promise<boolean> {
    // Throttle checks to prevent rapid re-checks
    const now = Date.now();
    if (now - this.lastDeviceCheck < this.deviceCheckThrottle) {
      return this.isDeviceAvailable;
    }
    this.lastDeviceCheck = now;

    try {
      // First check if the API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        this.handleDeviceUnavailable('API không khả dụng');
        return false;
      }

      // Then check for actual devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');
      
      if (hasAudioInput !== this.isDeviceAvailable) {
        this.isDeviceAvailable = hasAudioInput;
        if (hasAudioInput) {
          await this.checkInitialPermission();
        } else {
          this.handleDeviceUnavailable();
        }
      }

      return hasAudioInput;
    } catch (error) {
      console.error('Error checking device availability:', error);
      this.handleDeviceUnavailable('Lỗi kiểm tra thiết bị');
      return false;
    }
  }

  private handleDeviceUnavailable(customMessage?: string) {
    this.isDeviceAvailable = false;
    this.updatePermissionState('unavailable',
      customMessage || 'Không tìm thấy thiết bị microphone. Vui lòng kết nối microphone và thử lại.');
    
    if (this.isListeningSubject.value) {
      this.stopListening();
    }
  }

  private async checkInitialPermission() {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.handlePermissionState(permission.state as 'prompt' | 'granted' | 'denied');
      
      permission.addEventListener('change', () => {
        this.handlePermissionState(permission.state as 'prompt' | 'granted' | 'denied');
      });
    } catch (error) {
      console.error('Error checking permission:', error);
      this.updatePermissionState('prompt', 'Vui lòng cho phép truy cập microphone khi được yêu cầu');
    }
  }

  private handlePermissionState(state: 'prompt' | 'granted' | 'denied') {
    if (!this.isDeviceAvailable) {
      return; // Don't update permission state if no device is available
    }

    switch (state) {
      case 'granted':
        this.updatePermissionState('granted');
        break;
      case 'denied':
        if (navigator.userAgent.includes('Chrome')) {
          this.updatePermissionState('blocked', 
            'Microphone đã bị chặn. Vui lòng mở cài đặt trình duyệt để cho phép truy cập.');
        } else {
          this.updatePermissionState('denied',
            'Quyền truy cập microphone bị từ chối. Vui lòng thử lại hoặc kiểm tra cài đặt trình duyệt.');
        }
        break;
      case 'prompt':
        this.updatePermissionState('prompt',
          'Nhấn vào nút micro và cho phép truy cập microphone để bắt đầu');
        break;
    }
  }

  private updatePermissionState(
    state: 'prompt' | 'granted' | 'denied' | 'blocked' | 'unavailable',
    errorMessage?: string
  ) {
    // Only update if the state or message has actually changed
    const currentState = this.permissionSubject.value;
    if (currentState.state !== state || currentState.errorMessage !== errorMessage) {
      this.permissionSubject.next({ state, errorMessage });
      
      if ((state === 'denied' || state === 'blocked' || state === 'unavailable') && this.isListeningSubject.value) {
        this.stopListening();
      }
    }
  }

  private initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new window.webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'vi-VN';

      this.recognition.onstart = () => {
        console.log('Speech recognition started');
        this.isListeningSubject.next(true);
        this.currentRestartAttempt = 0;
        
        // Clear any existing timeouts
        if (this.permissionTimeout) {
          clearTimeout(this.permissionTimeout);
          this.permissionTimeout = null;
        }
        if (this.restartTimeout) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = null;
        }
      };

      this.recognition.onend = () => {
        console.log('Speech recognition ended');
        
        // Only update listening state if we're not trying to restart
        if (!this.recognition.isListening || this.currentRestartAttempt >= this.maxRestartAttempts) {
          this.isListeningSubject.next(false);
        }

        // If we're supposed to be listening but recognition ended, try to restart
        if (this.recognition.isListening && this.currentRestartAttempt < this.maxRestartAttempts) {
          console.log('Attempting to restart recognition...');
          this.currentRestartAttempt++;
          
          // Add a small delay before restarting
          this.restartTimeout = setTimeout(() => {
            if (this.recognition.isListening) {
              try {
                this.recognition.start();
              } catch (e) {
                console.error('Error restarting recognition:', e);
                this.errorSubject.next('Có lỗi xảy ra khi khởi động lại ghi âm');
                this.isListeningSubject.next(false);
              }
            }
          }, 1000);
        } else if (this.currentRestartAttempt >= this.maxRestartAttempts) {
          console.log('Max restart attempts reached');
          this.errorSubject.next('Không thể duy trì kết nối ghi âm. Vui lòng thử lại.');
          this.recognition.isListening = false;
          this.isListeningSubject.next(false);
        }
      };

      this.recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        
        if (event.results[last].isFinal) {
          console.log('Final transcript:', transcript);
          this.transcriptSubject.next(transcript);
          
          // Reset restart attempts on successful transcription
          this.currentRestartAttempt = 0;
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Recognition error:', event.error);
        
        switch (event.error) {
          case 'not-allowed':
            if (event.timeStamp - this.recognition.startTime < 100) {
              this.updatePermissionState('blocked',
                'Microphone đã bị chặn. Vui lòng mở cài đặt trình duyệt để cho phép truy cập.');
            } else {
              this.updatePermissionState('denied',
                'Quyền truy cập microphone bị từ chối. Vui lòng thử lại.');
            }
            this.isListeningSubject.next(false);
            break;
          case 'audio-capture':
            this.handleDeviceUnavailable();
            break;
          case 'no-speech':
            // Don't show error for no speech, just log it
            console.log('No speech detected');
            break;
          case 'network':
            this.errorSubject.next('Lỗi kết nối mạng, vui lòng kiểm tra kết nối internet');
            break;
          default:
            this.errorSubject.next('Có lỗi xảy ra, vui lòng thử lại');
        }
      };
    } else {
      console.error('Speech recognition not supported');
      this.errorSubject.next('Trình duyệt không hỗ trợ nhận dạng giọng nói');
    }
  }

  async requestPermission(): Promise<boolean> {
    // First check device availability
    const deviceAvailable = await this.checkDeviceAvailability();
    if (!deviceAvailable) {
      return false;
    }

    try {
      // Set a timeout to detect if the permission dialog was ignored
      if (this.permissionTimeout) {
        clearTimeout(this.permissionTimeout);
      }
      this.permissionTimeout = setTimeout(() => {
        this.updatePermissionState('prompt',
          'Không nhận được phản hồi cho phép truy cập microphone. Vui lòng thử lại.');
      }, 10000);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      // Clear the timeout as we got a response
      if (this.permissionTimeout) {
        clearTimeout(this.permissionTimeout);
        this.permissionTimeout = null;
      }
      
      this.updatePermissionState('granted');
      return true;
    } catch (error: any) {
      // Clear the timeout as we got a response
      if (this.permissionTimeout) {
        clearTimeout(this.permissionTimeout);
        this.permissionTimeout = null;
      }

      console.error('Error requesting permission:', error);
      
      if (error.name === 'NotAllowedError') {
        if (error.message.includes('Permission denied by system')) {
          this.updatePermissionState('blocked',
            'Microphone bị chặn bởi hệ thống. Vui lòng kiểm tra cài đặt quyền truy cập của thiết bị.');
        } else {
          this.updatePermissionState('denied',
            'Quyền truy cập microphone bị từ chối. Vui lòng thử lại.');
        }
      } else if (error.name === 'NotFoundError') {
        this.handleDeviceUnavailable();
      } else {
        this.updatePermissionState('denied',
          'Không thể truy cập microphone. Vui lòng thử lại hoặc kiểm tra cài đặt thiết bị.');
      }
      
      return false;
    }
  }

  async startListening() {
    if (!this.recognition) {
      this.errorSubject.next('Trình duyệt không hỗ trợ nhận dạng giọng nói');
      return;
    }

    // Check device availability before starting
    const deviceAvailable = await this.checkDeviceAvailability();
    if (!deviceAvailable) {
      return;
    }

    const permissionGranted = await this.requestPermission();
    if (permissionGranted) {
      this.recognition.isListening = true;
      try {
        this.recognition.startTime = performance.now();
        this.recognition.start();
        console.log('Started listening');
      } catch (error) {
        console.error('Error starting recognition:', error);
        this.errorSubject.next('Có lỗi xảy ra khi bắt đầu ghi âm');
        this.isListeningSubject.next(false);
      }
    }
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.isListening = false;
      try {
        // Clear any pending restart timeouts
        if (this.restartTimeout) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = null;
        }
        this.recognition.stop();
        console.log('Stopped listening');
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
      this.isListeningSubject.next(false);
    }
  }

  ngOnDestroy() {
    if (this.deviceCheckInterval) {
      clearInterval(this.deviceCheckInterval);
    }
    if (this.permissionTimeout) {
      clearTimeout(this.permissionTimeout);
    }
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    this.stopListening();
  }
}
