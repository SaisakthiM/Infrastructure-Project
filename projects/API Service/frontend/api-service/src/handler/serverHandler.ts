import axios from "axios"


export async function serverCheck(): Promise<boolean>  {
    try {
        const res = await axios.get("/api-service/api/")
        return res.status === 200
    } catch (error) {
        console.log(error)
        return false
    }
}
serverCheck()