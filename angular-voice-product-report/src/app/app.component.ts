import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ProductListComponent } from './components/product-list/product-list.component';
import { VoiceChatComponent } from './components/voice-chat/voice-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ProductListComponent, VoiceChatComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-white shadow">
        <div class="max-w-7xl mx-auto py-6 px-4">
          <h1 class="text-3xl font-bold text-gray-900">
            Quản lý sản phẩm
          </h1>
        </div>
      </header>

      <!-- Main Content -->
      <main>
        <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <app-product-list #productList></app-product-list>
          <app-voice-chat></app-voice-chat>
        </div>
      </main>
    </div>
  `,
  styles: []
})
export class AppComponent {
  @ViewChild('productList') productList!: ProductListComponent;
  @ViewChild(VoiceChatComponent) voiceChat!: VoiceChatComponent;

  ngAfterViewInit() {
    if (this.voiceChat && this.productList) {
      this.voiceChat.setProductList(this.productList);
    }
  }
}
