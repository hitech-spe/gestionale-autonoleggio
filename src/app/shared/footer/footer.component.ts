import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {NgOptimizedImage} from "@angular/common";

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    imports: [RouterLink, TranslateModule, NgOptimizedImage],
    standalone: true
})
export class FooterComponent {
    currentYear: number = new Date().getFullYear();
}
