import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatStepperModule} from '@angular/material/stepper';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatSelectModule} from '@angular/material/select';
import {MatIconModule} from '@angular/material/icon';
import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    RouterOutlet, 
    ReactiveFormsModule, 
    MatStepperModule, 
    MatInputModule, 
    MatButtonModule, 
    MatSelectModule, 
    MatIconModule, 
    CommonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  isEligible = signal<boolean | null>(null);
  isSubmitting = signal<boolean>(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  step1Form: FormGroup = this.fb.group({
    trabalhaSeisMeses: [null, Validators.required]
  });

  step2Form: FormGroup = this.fb.group({
    cpf: ['', [Validators.required, Validators.pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)]],
    celular: ['', [Validators.required]],
    sexo: ['', Validators.required]
  });

  step3Form: FormGroup = this.fb.group({
    valor: ['', [Validators.required, Validators.min(500)]],
    parcelas: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]]
  });

  step4Form: FormGroup = this.fb.group({
    nome: ['', Validators.required],
    dataNascimento: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}\/\d{4}$/)]],
    cidade: ['', Validators.required]
  });

  checkEligibility(value: string) {
    if (value === 'sim') {
      this.isEligible.set(true);
    } else {
      this.isEligible.set(false);
    }
  }

  // Simple mask helpers
  formatCPF(event: Event) {
    const target = event.target as HTMLInputElement;
    let v = target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    this.step2Form.patchValue({ cpf: v });
  }

  formatPhone(event: Event) {
    const target = event.target as HTMLInputElement;
    let v = target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d)(\d{4})$/, '$1-$2');
    this.step2Form.patchValue({ celular: v });
  }

  formatDate(event: Event) {
    const target = event.target as HTMLInputElement;
    let v = target.value.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    v = v.replace(/(\d{2})(\d)/, '$1/$2');
    v = v.replace(/(\d{2})(\d)/, '$1/$2');
    this.step4Form.patchValue({ dataNascimento: v });
  }

  async submitSimulation() {
    if (this.step1Form.invalid || this.step2Form.invalid || this.step3Form.invalid || this.step4Form.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const fullData = {
      ...this.step1Form.value,
      ...this.step2Form.value,
      ...this.step3Form.value,
      ...this.step4Form.value
    };

    this.http.post<{success: boolean, message: string}>('/api/simular', fullData).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success) {
          this.successMessage.set(res.message);
        } else {
          this.errorMessage.set(res.message);
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Erro ao enviar simulação. Tente novamente.');
      }
    });
  }

  reset() {
    this.successMessage.set(null);
    this.isEligible.set(null);
    this.step1Form.reset();
    this.step2Form.reset();
    this.step3Form.reset();
    this.step4Form.reset();
  }
}
