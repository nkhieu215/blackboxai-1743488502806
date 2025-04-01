import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Product {
  name: string;
  code: string;
  errorCount: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mx-auto p-4">
      <table class="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên sản phẩm</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã sản phẩm</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng lỗi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          @for (product of products; track product.code) {
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">{{product.name}}</td>
              <td class="px-6 py-4 whitespace-nowrap">{{product.code}}</td>
              <td class="px-6 py-4 whitespace-nowrap">{{product.errorCount}}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class ProductListComponent {
  products: Product[] = [];

  addProduct(name: string, code: string, errorCount: number) {
    this.products.push({ name, code, errorCount });
  }
}
