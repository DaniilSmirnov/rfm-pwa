import './ImageViewerModal.css';
import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';
import Button from '../components/Button.jsx';
import { assetUrl } from '../rallyfans.js';

export default function ImageViewerModal({ image, onClose }) {
  if (!image) {
    return <div id="imageModal" className="image-modal" hidden />;
  }

  return (
    <Dialog.Root
      open={Boolean(image)}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose?.();
      }}
    >
      <Dialog.Overlay asChild>
        <div
          id="imageModal"
          className="image-modal"
          onClick={event => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <Dialog.Content asChild>
            <div className="image-modal-content">
              <Dialog.Title asChild>
                <span className="sr-only">Материал гонки</span>
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  id="imageModalClose"
                  className="image-modal-close"
                  aria-label="Закрыть"
                  type="button"
                >
                  ×
                </Button>
              </Dialog.Close>
              <div className="image-modal-inner">
                <img id="imageModalImg" src={assetUrl(image)} alt="Материал гонки" />
              </div>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
