import './App.css'
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import { Home } from './components/Home'
import { Upload } from './components/Upload'
import { Ask } from './components/Ask'
import { Library } from './components/Library'

function App() {
    return (
		<BrowserRouter basename="/document">
			<Routes>
				<Route path='/' element={<Home></Home>}></Route>
				<Route path='/upload' element={<Upload></Upload>}></Route>
				<Route path='/ask' element={<Ask></Ask>}></Route>
				<Route path='/library' element={<Library />} />
			</Routes>
		</BrowserRouter>
	)
}

export default App
