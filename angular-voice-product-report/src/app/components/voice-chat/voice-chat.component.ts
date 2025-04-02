import { Component, ViewChild, ElementRef, inject, HostListener, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpeechService, PermissionState } from '../../services/speech.service';
import { ProductListComponent } from '../product-list/product-list.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-voice-chat',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-50">
      <!-- Tooltip -->
      @if (showTooltip && permissionState?.errorMessage && isErrorState(permissionState?.state)) {
        <div class="absolute bottom-16 right-0 mb-2 w-64 bg-gray-900 text-white text-sm rounded-lg p-3 shadow-lg">
          {{ permissionState?.errorMessage }}
          <div class="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
        </div>
      }

      <!-- Keyboard Shortcut Hint -->
      @if (!isChatOpen && !isErrorState(permissionState?.state)) {
        <div class="absolute bottom-16 right-0 mb-2">
          <div class="bg-gray-700 text-white text-xs rounded px-2 py-1 flex items-center space-x-1">
            <span>Phím tắt:</span>
            <kbd class="px-2 py-0.5 bg-gray-600 rounded">Space</kbd>
            <span>hoặc</span>
            <kbd class="px-2 py-0.5 bg-gray-600 rounded">Enter</kbd>
          </div>
        </div>
      }

      <!-- Microphone Icon Button -->
      <button 
        #micButton
        (click)="toggleChat()"
        (mouseenter)="showTooltip = true"
        (mouseleave)="showTooltip = false"
        [class]="getMicrophoneButtonClass()"
        [attr.aria-label]="isListening ? 'Dừng ghi âm (Space hoặc Enter)' : 'Bắt đầu ghi âm (Space hoặc Enter)'"
        [disabled]="isErrorState(permissionState?.state)"
        [attr.aria-expanded]="isChatOpen"
        role="button"
        tabindex="0"
      >
        <i 
          class="fas" 
          [class]="getMicrophoneIconClass()"
          [class.animate-pulse]="isListening"
        ></i>
      </button>

      <!-- Chat Window -->
      @if (isChatOpen) {
        <div 
          class="absolute bottom-20 right-0 w-96 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
          role="dialog"
          aria-labelledby="chatTitle"
        >
          <!-- Header -->
          <div class="p-4 bg-blue-500 text-white flex justify-between items-center">
            <h3 id="chatTitle" class="text-lg font-semibold">Khai báo thông tin</h3>
            <button 
              (click)="toggleChat()"
              class="text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-500 rounded"
              aria-label="Đóng cửa sổ chat"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Permission Request -->
          @if (permissionState?.state === 'prompt') {
            <div class="p-6 bg-yellow-50 border-b border-yellow-100">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <i class="fas fa-microphone-alt text-yellow-400 text-xl"></i>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-yellow-800">
                    Cần quyền truy cập microphone
                  </h3>
                  <div class="mt-2 text-sm text-yellow-700">
                    <p>Để sử dụng tính năng ghi âm, bạn cần cho phép truy cập microphone khi được yêu cầu.</p>
                    <p class="mt-1 text-xs">Phím tắt: Space hoặc Enter để bắt đầu/dừng ghi âm</p>
                  </div>
                  <div class="mt-4">
                    <button
                      type="button"
                      (click)="retryPermission()"
                      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                    >
                      <i class="fas fa-redo-alt mr-2"></i>
                      Yêu cầu quyền truy cập
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Device Unavailable -->
          @if (permissionState?.state === 'unavailable') {
            <div class="p-6 bg-orange-50 border-b border-orange-100">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <i class="fas fa-exclamation-triangle text-orange-400 text-xl"></i>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-orange-800">
                    Không tìm thấy thiết bị microphone
                  </h3>
                  <div class="mt-2 text-sm text-orange-700">
                    <p>{{ permissionState?.errorMessage }}</p>
                    <ul class="mt-2 list-disc list-inside">
                      <li>Kiểm tra kết nối microphone với máy tính</li>
                      <li>Đảm bảo microphone không bị tắt tiếng</li>
                      <li>Thử kết nối lại thiết bị và làm mới trang</li>
                    </ul>
                  </div>
                  <div class="mt-4">
                    <button
                      type="button"
                      (click)="retryPermission()"
                      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 w-full justify-center"
                    >
                      <i class="fas fa-sync mr-2"></i>
                      Kiểm tra lại thiết bị
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Permission Denied or Blocked -->
          @if (permissionState?.state === 'denied' || permissionState?.state === 'blocked') {
            <div class="p-6 bg-red-50 border-b border-red-100">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <i class="fas fa-exclamation-circle text-red-400 text-xl"></i>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">
                    {{ permissionState?.state === 'blocked' ? 'Microphone bị chặn' : 'Không thể truy cập microphone' }}
                  </h3>
                  <div class="mt-2 text-sm text-red-700">
                    <p>{{ permissionState?.errorMessage }}</p>
                  </div>
                  <div class="mt-4 space-y-2">
                    @if (permissionState?.state === 'denied') {
                      <button
                        type="button"
                        (click)="retryPermission()"
                        class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 w-full justify-center"
                      >
                        <i class="fas fa-redo-alt mr-2"></i>
                        Thử lại
                      </button>
                    }
                    <button
                      type="button"
                      (click)="openBrowserSettings()"
                      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 w-full justify-center"
                    >
                      <i class="fas fa-cog mr-2"></i>
                      Mở cài đặt trình duyệt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Chat Messages -->
          <div 
            class="p-4 h-96 overflow-y-auto bg-gray-50" 
            #chatContainer
            role="log"
            aria-label="Lịch sử chat"
          >
            @for (message of messages; track message.id) {
              <div 
                [ngClass]="[
                  'mb-3 p-3 rounded-lg shadow transition-all duration-300',
                  message.type === 'system' ? 'bg-white text-gray-700' : 
                  message.type === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                ]"
                role="article"
              >
                @if (message.type === 'error') {
                  <i class="fas fa-exclamation-circle mr-2"></i>
                }
                {{ message.text }}
              </div>
            }
          </div>

          <!-- Status Bar -->
          <div class="p-3 bg-gray-100 border-t border-gray-200">
            <p class="text-sm text-gray-600 flex items-center">
              @if (permissionState?.state === 'granted') {
                <i class="fas mr-2" [class]="isListening ? 'fa-microphone text-red-500 animate-pulse' : 'fa-info-circle'"></i>
                {{ isListening ? 'Đang lắng nghe...' : 'Nhấn vào nút micro hoặc Space/Enter để bắt đầu' }}
              } @else {
                <i class="fas fa-microphone-slash mr-2 text-gray-500"></i>
                {{ permissionState?.errorMessage }}
              }
            </p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .chat-message {
      transition: all 0.3s ease;
    }

    .chat-message:hover {
      transform: translateX(2px);
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    .animate-pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }

    /* Improved focus styles */
    :focus {
      outline: none;
    }

    :focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
    }

    /* High contrast mode focus styles */
    @media (forced-colors: active) {
      :focus-visible {
        outline: 2px solid CanvasText;
        outline-offset: 2px;
      }
    }
  `]
})
export class VoiceChatComponent implements AfterViewInit, OnDestroy {
  private speechService = inject(SpeechService);
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('micButton') micButton!: ElementRef;

  private destroy$ = new Subject<void>();
  private scrollTimeout: any;
  private saveTimeout: any;

  isChatOpen = false;
  isListening = false;
  showTooltip = false;
  permissionState?: PermissionState;
  messages: Array<{ id: number, text: string, type: 'system' | 'user' | 'error' }> = [];
  private messageCounter = 0;
  private currentProduct: { name?: string, errorCount?: number } = {};
  private productList?: ProductListComponent;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle Space and Enter for the mic button
    if ((event.code === 'Space' || event.code === 'Enter') && 
        document.activeElement === this.micButton?.nativeElement) {
      event.preventDefault();
      this.toggleChat();
    }

    // Handle Escape to close chat
    if (event.code === 'Escape' && this.isChatOpen) {
      event.preventDefault();
      this.toggleChat();
    }
  }

  ngAfterViewInit() {
    // Set initial focus on the mic button
    if (this.micButton?.nativeElement) {
      this.micButton.nativeElement.focus();
    }
  }

  constructor() {
    // Use takeUntil to automatically unsubscribe when component is destroyed
    this.speechService.transcript$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(text => {
      if (text) {
        this.handleSpeechInput(text);
      }
    });

    this.speechService.error$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(error => {
      if (error) {
        this.addErrorMessage(error);
      }
    });

    this.speechService.isListening$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isListening => {
      this.isListening = isListening;
    });

    this.speechService.permission$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(state => {
      this.permissionState = state;
      if (this.isErrorState(state.state) && this.isListening) {
        this.stopListening();
      }
    });
  }

  ngOnDestroy() {
    // Clean up all subscriptions and timeouts
    this.destroy$.next();
    this.destroy$.complete();

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Stop listening if active
    if (this.isListening) {
      this.stopListening();
    }
  }

  isErrorState(state?: string): boolean {
    return state === 'denied' || state === 'blocked' || state === 'unavailable';
  }

  getMicrophoneButtonClass(): string {
    const baseClass = 'rounded-full p-4 shadow-lg transition-all duration-300 flex items-center justify-center w-14 h-14 focus:outline-none focus:ring-2 focus:ring-offset-2';
    if (this.isListening) {
      return `${baseClass} bg-red-500 hover:bg-red-600 focus:ring-red-500`;
    }
    if (this.isErrorState(this.permissionState?.state)) {
      return `${baseClass} bg-gray-500 focus:ring-gray-500`;
    }
    return `${baseClass} bg-blue-500 hover:bg-blue-600 focus:ring-blue-500`;
  }

  getMicrophoneIconClass(): string {
    if (this.isListening) {
      return 'fa-stop text-2xl';
    }
    if (this.isErrorState(this.permissionState?.state)) {
      return 'fa-microphone-slash text-2xl';
    }
    return 'fa-microphone text-2xl';
  }

  setProductList(productList: ProductListComponent) {
    this.productList = productList;
  }

  toggleChat() {
    if (!this.isChatOpen) {
      this.isChatOpen = true;
      this.startNewConversation();
    } else {
      this.stopListening();
      this.isChatOpen = false;
      this.currentProduct = {};
    }
  }

  async retryPermission() {
    if (await this.speechService.requestPermission()) {
      this.startNewConversation();
    }
  }

  private startNewConversation() {
    this.messages = [];
    this.addSystemMessage('Khai báo thông tin sản phẩm');
    if (this.permissionState?.state === 'granted') {
      this.speechService.startListening();
    }
  }

  private stopListening() {
    this.speechService.stopListening();
  }

  openBrowserSettings() {
    if (navigator.userAgent.includes('Chrome')) {
      window.open('chrome://settings/content/microphone', '_blank');
    } else if (navigator.userAgent.includes('Firefox')) {
      window.open('about:preferences#privacy', '_blank');
    } else {
      window.open('about:preferences', '_blank');
    }
  }

  private handleSpeechInput(text: string) {
    this.addUserMessage(text);

    if (!this.currentProduct.name) {
      this.currentProduct.name = text;
      this.addSystemMessage('Khai báo số lượng lỗi');
    } else if (!this.currentProduct.errorCount) {
      const errorCount = parseInt(text);
      if (!isNaN(errorCount) && errorCount >= 0) {
        this.currentProduct.errorCount = errorCount;
        this.addSystemMessage('Thành công');
        this.saveProduct();
      } else {
        this.addErrorMessage('Vui lòng khai báo số lượng lỗi bằng số không âm');
      }
    }
  }

  private saveProduct() {
    if (this.productList && this.currentProduct.name && this.currentProduct.errorCount !== undefined) {
      const productCode = 'P' + Date.now().toString().slice(-6);
      this.productList.addProduct(
        this.currentProduct.name,
        productCode,
        this.currentProduct.errorCount
      );
      
      // Store timeout reference for cleanup
      this.saveTimeout = setTimeout(() => {
        this.toggleChat();
      }, 1500);
    }
  }

  private addSystemMessage(text: string) {
    this.addMessage(text, 'system');
  }

  private addUserMessage(text: string) {
    this.addMessage(text, 'user');
  }

  private addErrorMessage(text: string) {
    this.addMessage(text, 'error');
  }

  private addMessage(text: string, type: 'system' | 'user' | 'error') {
    this.messages.push({ id: ++this.messageCounter, text, type });
    
    // Store timeout reference for cleanup
    this.scrollTimeout = setTimeout(() => {
      if (this.chatContainer?.nativeElement) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    });
  }
}
