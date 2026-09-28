import './ImageViewerModal.css';
import React from 'react';
import Button from '../components/Button.jsx';
import { assetUrl } from '../rallyfans.js';

export default function ImageViewerModal({image,onClose}){
  return <div id="imageModal" className="image-modal" hidden={!image} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><Button id="imageModalClose" className="image-modal-close" aria-label="Закрыть" type="button" onClick={onClose}>×</Button><div className="image-modal-inner"><img id="imageModalImg" src={image?assetUrl(image):undefined} alt="Материал гонки"/></div></div>;
}
