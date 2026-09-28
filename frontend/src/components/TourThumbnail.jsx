import PhotoPlaceholder from './PhotoPlaceholder';

function TourThumbnail({ tour, height = '200px', borderRadius = '4px' }) {
  if (tour.photo) {
    return (
      <img
        src={tour.photo}
        alt={tour.title}
        className="tw-card"
        style={{ width: '100%', height, objectFit: 'cover', borderRadius, display: 'block' }}
      />
    );
  }
  return <PhotoPlaceholder tone={tour.color} height={height} borderRadius={borderRadius} label="사진 준비중" />;
}

export default TourThumbnail;
