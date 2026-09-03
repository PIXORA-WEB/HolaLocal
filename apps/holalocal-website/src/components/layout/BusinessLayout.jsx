import { Outlet } from 'react-router-dom'

function BusinessLayout() {
  return (
    <div className="business-area">
      <div className="business-area__content">
        <Outlet />
      </div>
    </div>
  )
}

export default BusinessLayout
