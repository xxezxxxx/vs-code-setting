import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Calculator from "./pages/Calculator";
import Users from "./pages/Users";
import Echo from "./pages/Echo";
import { Test01 } from "./pages/Test01";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "calculator", element: <Calculator /> },
      { path: "users", element: <Users /> },
      { path: "echo", element: <Echo /> },
      { path: "test01", element: <Test01 /> },
      { path: "test", element: <Test /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
