import { Component, Input } from '@angular/core';

import { HttpService } from 'app/core/core-services/http.service';

@Component({
    selector: 'os-resource',
    templateUrl: './resource.component.html',
    styleUrls: ['./resource.component.scss']
})
export class ResourceComponent {
    @Input()
    public set source(src: string) {
        this._source = src;
        this.startLoading();
    }

    public get progress(): number {
        return this.totalBytesToLoad === 0 ? 0 : this.bytesLoaded / this.totalBytesToLoad;
    }

    public resource: any;

    public resourceType = '';

    public loaded = false;

    private bytesLoaded = 0;

    private totalBytesToLoad = 0;

    private _source: string;

    public constructor(private http: HttpService) {}

    private addListenersToReader(fileReader: FileReader): void {
        fileReader.onprogress = event => this.handleReaderEvent(event, fileReader);
        fileReader.onload = event => this.handleReaderEvent(event, fileReader);
    }

    private startLoading(): void {
        if (!this.loaded && this._source) {
            this.loadResource();
        }
    }

    private loadResource(): void {
        this.http.get<Blob>(this._source, null, null, null, 'blob').then(response => {
            this.readBlobData(response);
        });
    }

    private readBlobData(data: Blob): void {
        const fileReader = new FileReader();
        this.addListenersToReader(fileReader);
        this.bytesLoaded = 0;
        this.totalBytesToLoad = data.size;
        this.resourceType = data.type.split('/')[0];
        switch (this.resourceType) {
            case 'text':
                fileReader.readAsText(data);
                break;
            case 'image':
                fileReader.readAsDataURL(data);
                break;
            default:
                throw new Error('MimeType of data is not specified');
        }
    }

    private handleReaderEvent(event: ProgressEvent<FileReader>, fileReader: FileReader): void {
        this.bytesLoaded = event.loaded;
        if (event.type === 'load') {
            const result = fileReader.result;
            if (typeof result === 'string') {
                this.resource = result;
            } else {
                console.warn('fileReader.result is an arraybuffer:', result);
            }
            this.finishLoading();
        }
    }

    private finishLoading(): void {
        this.loaded = true;
    }
}
