import ClientPortal from './pages/ClientPortal';
import Clients from './pages/Clients';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import TicketDetail from './pages/TicketDetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ClientPortal": ClientPortal,
    "Clients": Clients,
    "Dashboard": Dashboard,
    "Settings": Settings,
    "TicketDetail": TicketDetail,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};