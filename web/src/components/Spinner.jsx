export default function Spinner({ full }) {
  return <div className={`spinner${full ? ' full' : ''}`}><div></div></div>
}
